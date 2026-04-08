import { NextResponse } from 'next/server';
import { resourceMonitor } from '@/lib/resourceMonitor';

/**
 * 资源监控指标端点
 * GET /api/metrics
 */
export async function GET() {
  try {
    const metrics = await resourceMonitor.getMetrics();

    return NextResponse.json({
      cpu: {
        usage: metrics.cpuUsage,
        unit: 'percent',
      },
      memory: {
        usage: metrics.memoryUsage,
        used: metrics.memoryUsedMB,
        total: metrics.memoryTotalMB,
        unit: 'MB',
      },
      timestamp: metrics.timestamp,
      uptime: process.uptime(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取指标失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
