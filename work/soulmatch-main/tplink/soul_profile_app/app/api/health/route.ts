import { NextResponse } from 'next/server';
import { resourceMonitor } from '@/lib/resourceMonitor';

/**
 * 健康检查端点
 * GET /api/health
 */
export async function GET() {
  try {
    const result = await resourceMonitor.check();

    return NextResponse.json({
      status: result.level === 'ok' ? 'healthy' : result.level,
      message: result.message,
      metrics: {
        cpu: `${result.metrics.cpuUsage.toFixed(1)}%`,
        memory: `${result.metrics.memoryUsage.toFixed(1)}%`,
        memoryUsed: `${result.metrics.memoryUsedMB}MB`,
        memoryTotal: `${result.metrics.memoryTotalMB}MB`,
      },
      timestamp: new Date(result.metrics.timestamp).toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: '健康检查失败',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
