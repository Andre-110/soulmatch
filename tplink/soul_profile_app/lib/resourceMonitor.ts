import os from 'os';
import fs from 'fs';

export type ResourceMetrics = {
  cpuUsage: number;
  memoryUsage: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  timestamp: number;
};

export type ResourceThresholds = {
  cpuWarning: number;
  cpuCritical: number;
  memoryWarning: number;
  memoryKill: number;
};

const DEFAULT_THRESHOLDS: ResourceThresholds = {
  cpuWarning: 80,
  cpuCritical: 95,
  memoryWarning: 75,
  memoryKill: 90,
};

/** Linux: 用 /proc/stat 计算 CPU，无 shell、无子进程，适合小内存机器 */
let lastCpuTotals: { idle: number; total: number } | null = null;

function readCpuPercentLinux(): number {
  try {
    const line = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
    if (!line.startsWith('cpu ')) return 0;
    const nums = line
      .trim()
      .split(/\s+/)
      .slice(1)
      .map((x) => parseInt(x, 10));
    const idle = nums[3];
    const total = nums.reduce((a, b) => a + b, 0);
    if (lastCpuTotals === null) {
      lastCpuTotals = { idle, total };
      return 0;
    }
    const idleDelta = idle - lastCpuTotals.idle;
    const totalDelta = total - lastCpuTotals.total;
    lastCpuTotals = { idle, total };
    if (totalDelta <= 0) return 0;
    return Math.max(0, Math.min(100, 100 * (1 - idleDelta / totalDelta)));
  } catch {
    return 0;
  }
}

function readCpuPercentFallback(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }
  if (totalTick <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - totalIdle / totalTick) * 100));
}

function readCpuPercent(): number {
  if (process.platform === 'linux') return readCpuPercentLinux();
  return readCpuPercentFallback();
}

class ResourceMonitor {
  private thresholds: ResourceThresholds;
  private isShuttingDown = false;
  private lastMetrics: ResourceMetrics | null = null;
  private degradedUntil = 0;

  constructor(thresholds: Partial<ResourceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 同步、低开销：不 exec 外部命令，避免小内存机器上频繁 fork 导致 OOM。
   */
  getMetrics(): ResourceMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuUsage = readCpuPercent();

    const metrics: ResourceMetrics = {
      cpuUsage,
      memoryUsage: (usedMem / totalMem) * 100,
      memoryUsedMB: Math.round(usedMem / 1024 / 1024),
      memoryTotalMB: Math.round(totalMem / 1024 / 1024),
      timestamp: Date.now(),
    };
    this.lastMetrics = metrics;
    return metrics;
  }

  /** 仅内存比例，供后台定时器快速判断，不做 CPU 计算 */
  getMemoryUsagePercent(): number {
    const totalMem = os.totalmem();
    return ((totalMem - os.freemem()) / totalMem) * 100;
  }

  async check(): Promise<{
    safe: boolean;
    level: 'ok' | 'warning' | 'critical' | 'kill';
    message: string;
    metrics: ResourceMetrics;
  }> {
    const metrics = this.getMetrics();

    if (metrics.memoryUsage >= this.thresholds.memoryKill) {
      return {
        safe: false,
        level: 'kill',
        message: `内存使用率 ${metrics.memoryUsage.toFixed(1)}% 超过危险阈值 ${this.thresholds.memoryKill}%，服务即将停止`,
        metrics,
      };
    }

    if (metrics.cpuUsage >= this.thresholds.cpuCritical) {
      return {
        safe: false,
        level: 'critical',
        message: `CPU 使用率 ${metrics.cpuUsage.toFixed(1)}% 超过危险阈值 ${this.thresholds.cpuCritical}%，拒绝新请求`,
        metrics,
      };
    }

    if (metrics.memoryUsage >= this.thresholds.memoryWarning) {
      return {
        safe: true,
        level: 'warning',
        message: `内存使用率 ${metrics.memoryUsage.toFixed(1)}% 超过警告阈值 ${this.thresholds.memoryWarning}%`,
        metrics,
      };
    }

    if (metrics.cpuUsage >= this.thresholds.cpuWarning) {
      return {
        safe: true,
        level: 'warning',
        message: `CPU 使用率 ${metrics.cpuUsage.toFixed(1)}% 超过警告阈值 ${this.thresholds.cpuWarning}%`,
        metrics,
      };
    }

    return {
      safe: true,
      level: 'ok',
      message: 'OK',
      metrics,
    };
  }

  async emergencyShutdown(reason: string) {
    const now = Date.now();
    if (this.isShuttingDown && now < this.degradedUntil) return;
    this.isShuttingDown = true;
    this.degradedUntil = now + 30_000;

    console.error('='.repeat(80));
    console.error('[ResourceMonitor] 🚨 进入降级保护');
    console.error('[ResourceMonitor] 原因:', reason);
    if (this.lastMetrics) {
      console.error('[ResourceMonitor] CPU:', this.lastMetrics.cpuUsage.toFixed(1) + '%');
      console.error(
        '[ResourceMonitor] 内存:',
        this.lastMetrics.memoryUsage.toFixed(1) + '%',
        `(${this.lastMetrics.memoryUsedMB}MB / ${this.lastMetrics.memoryTotalMB}MB)`,
      );
    }
    console.error('='.repeat(80));

    try {
      if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
        const { browserPool } = await import('@/lib/browserPool');
        await browserPool.forceClose();
        console.log('[ResourceMonitor] 浏览器实例已关闭');
      }
    } catch (error) {
      console.error('[ResourceMonitor] 关闭浏览器失败:', error);
    }

    setTimeout(() => {
      this.isShuttingDown = false;
    }, 30_000);
  }

  getLastMetrics(): ResourceMetrics | null {
    return this.lastMetrics;
  }

  isInShutdown(): boolean {
    return this.isShuttingDown;
  }
}

export const resourceMonitor = new ResourceMonitor({
  cpuWarning: parseInt(process.env.CPU_WARNING_THRESHOLD || '80', 10),
  cpuCritical: parseInt(process.env.CPU_CRITICAL_THRESHOLD || '95', 10),
  memoryWarning: parseInt(process.env.MEMORY_WARNING_THRESHOLD || '75', 10),
  memoryKill: parseInt(process.env.MEMORY_KILL_THRESHOLD || '90', 10),
});

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * 后台仅做「内存阈值」巡检：不跑 CPU、不 exec，间隔默认 60s，减轻小内存 VPS 压力。
 */
export function startResourceMonitoring() {
  if (monitorInterval) return;

  const intervalMs = Math.max(
    15_000,
    parseInt(process.env.RESOURCE_MONITOR_INTERVAL_MS || '120000', 10),
  );

  if (process.env.RESOURCE_MONITOR_ENABLED === '0') {
    return;
  }

  console.log('[ResourceMonitor] 轻量监控已启动（仅内存 / ' + intervalMs + 'ms）');

  monitorInterval = setInterval(() => {
    try {
      const memPct = resourceMonitor.getMemoryUsagePercent();
      const killThreshold = parseInt(process.env.MEMORY_KILL_THRESHOLD || '90', 10);
      if (memPct >= killThreshold) {
        void resourceMonitor.emergencyShutdown(
          `内存使用率 ${memPct.toFixed(1)}% 超过危险阈值 ${killThreshold}%`,
        );
      }
    } catch (error) {
      console.error('[ResourceMonitor] 监控检查失败:', error);
    }
  }, intervalMs);
}

export function stopResourceMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[ResourceMonitor] 停止资源监控');
  }
}

if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    stopResourceMonitoring();
  });
}
