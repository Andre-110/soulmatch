import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type ResourceMetrics = {
  cpuUsage: number;      // CPU 使用率 (0-100)
  memoryUsage: number;   // 内存使用率 (0-100)
  memoryUsedMB: number;  // 已使用内存 MB
  memoryTotalMB: number; // 总内存 MB
  timestamp: number;
};

export type ResourceThresholds = {
  cpuWarning: number;    // CPU 警告阈值
  cpuCritical: number;   // CPU 危险阈值
  memoryWarning: number; // 内存警告阈值
  memoryKill: number;    // 内存强制停止阈值
};

const DEFAULT_THRESHOLDS: ResourceThresholds = {
  cpuWarning: 80,      // CPU 超过 80% 警告
  cpuCritical: 99,     // CPU 超过 99% 才拒绝新请求（Playwright 截图本身就会拉高 CPU）
  memoryWarning: 75,   // 内存超过 75% 警告
  memoryKill: 90,      // 内存超过 90% 强制停止
};

class ResourceMonitor {
  private thresholds: ResourceThresholds;
  private isShuttingDown = false;
  private lastMetrics: ResourceMetrics | null = null;

  constructor(thresholds: Partial<ResourceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 获取当前资源使用情况
   */
  async getMetrics(): Promise<ResourceMetrics> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // 获取 CPU 使用率（通过 /proc/stat 或 os.cpus()）
    const cpuUsage = await this.getCpuUsage();

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

  /**
   * 获取 CPU 使用率
   */
  private async getCpuUsage(): Promise<number> {
    try {
      // Linux: 使用 top 命令获取 CPU 使用率
      if (process.platform === 'linux') {
        const { stdout } = await execAsync(
          "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
        );
        return parseFloat(stdout.trim()) || 0;
      }

      // macOS: 使用 ps 命令
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync(
          "ps -A -o %cpu | awk '{s+=$1} END {print s}'"
        );
        return parseFloat(stdout.trim()) || 0;
      }

      // 其他平台：使用 Node.js 内置方法（不太准确）
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      return ((1 - totalIdle / totalTick) * 100) || 0;
    } catch (error) {
      console.error('[ResourceMonitor] 获取 CPU 使用率失败:', error);
      return 0;
    }
  }

  /**
   * 检查资源是否超过阈值
   */
  async check(): Promise<{
    safe: boolean;
    level: 'ok' | 'warning' | 'critical' | 'kill';
    message: string;
    metrics: ResourceMetrics;
  }> {
    const metrics = await this.getMetrics();

    // 内存超过 kill 阈值：立即停止
    if (metrics.memoryUsage >= this.thresholds.memoryKill) {
      return {
        safe: false,
        level: 'kill',
        message: `内存使用率 ${metrics.memoryUsage.toFixed(1)}% 超过危险阈值 ${this.thresholds.memoryKill}%，服务即将停止`,
        metrics,
      };
    }

    // CPU 超过 critical 阈值：拒绝新请求
    if (metrics.cpuUsage >= this.thresholds.cpuCritical) {
      return {
        safe: false,
        level: 'critical',
        message: `CPU 使用率 ${metrics.cpuUsage.toFixed(1)}% 超过危险阈值 ${this.thresholds.cpuCritical}%，拒绝新请求`,
        metrics,
      };
    }

    // 内存超过 warning 阈值：警告
    if (metrics.memoryUsage >= this.thresholds.memoryWarning) {
      return {
        safe: true,
        level: 'warning',
        message: `内存使用率 ${metrics.memoryUsage.toFixed(1)}% 超过警告阈值 ${this.thresholds.memoryWarning}%`,
        metrics,
      };
    }

    // CPU 超过 warning 阈值：警告
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

  /**
   * 触发紧急停止
   */
  async emergencyShutdown(reason: string) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.error('='.repeat(80));
    console.error('[ResourceMonitor] 🚨 紧急停止服务');
    console.error('[ResourceMonitor] 原因:', reason);
    if (this.lastMetrics) {
      console.error('[ResourceMonitor] CPU:', this.lastMetrics.cpuUsage.toFixed(1) + '%');
      console.error('[ResourceMonitor] 内存:', this.lastMetrics.memoryUsage.toFixed(1) + '%',
        `(${this.lastMetrics.memoryUsedMB}MB / ${this.lastMetrics.memoryTotalMB}MB)`);
    }
    console.error('='.repeat(80));

    // 清理浏览器实例（动态导入避免 middleware 加载 playwright）
    try {
      // 只在 Node.js 环境且非 Edge Runtime 中导入
      if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
        const { browserPool } = await import('@/lib/browserPool');
        await browserPool.forceClose();
        console.log('[ResourceMonitor] 浏览器实例已关闭');
      }
    } catch (error) {
      console.error('[ResourceMonitor] 关闭浏览器失败:', error);
    }

    // 延迟退出，给日志时间写入
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }

  getLastMetrics(): ResourceMetrics | null {
    return this.lastMetrics;
  }

  isInShutdown(): boolean {
    return this.isShuttingDown;
  }
}

// 全局单例
export const resourceMonitor = new ResourceMonitor({
  cpuWarning: parseInt(process.env.CPU_WARNING_THRESHOLD || '80'),
  cpuCritical: parseInt(process.env.CPU_CRITICAL_THRESHOLD || '95'),
  memoryWarning: parseInt(process.env.MEMORY_WARNING_THRESHOLD || '75'),
  memoryKill: parseInt(process.env.MEMORY_KILL_THRESHOLD || '90'),
});

// 定期监控（每 10 秒）
let monitorInterval: NodeJS.Timeout | null = null;

export function startResourceMonitoring() {
  if (monitorInterval) return;

  console.log('[ResourceMonitor] 启动资源监控');
  console.log('[ResourceMonitor] 阈值配置:', {
    cpuWarning: resourceMonitor['thresholds'].cpuWarning + '%',
    cpuCritical: resourceMonitor['thresholds'].cpuCritical + '%',
    memoryWarning: resourceMonitor['thresholds'].memoryWarning + '%',
    memoryKill: resourceMonitor['thresholds'].memoryKill + '%',
  });

  monitorInterval = setInterval(async () => {
    try {
      const result = await resourceMonitor.check();

      if (result.level === 'kill') {
        await resourceMonitor.emergencyShutdown(result.message);
      } else if (result.level === 'critical') {
        console.warn('[ResourceMonitor] ⚠️ ', result.message);
      } else if (result.level === 'warning') {
        console.warn('[ResourceMonitor] ⚠️ ', result.message);
      }
    } catch (error) {
      console.error('[ResourceMonitor] 监控检查失败:', error);
    }
  }, 10000); // 每 10 秒检查一次
}

export function stopResourceMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[ResourceMonitor] 停止资源监控');
  }
}

// 进程退出时清理
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    stopResourceMonitoring();
  });
}
