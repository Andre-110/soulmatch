import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery';
import { startResourceMonitoring } from '@/lib/resourceMonitor';

// 启动资源监控（仅在运行中的 Node 服务；build 阶段 worker 不启，避免多进程重复定时器）
if (
  typeof window === 'undefined' &&
  process.env.RESOURCE_MONITOR_ENABLED !== '0' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  startResourceMonitoring();
}

/** 避免首页被长期静态缓存，部署后用户能尽快看到新版本 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'SoulMatch · 全网最准人格分身',
  description: '绑定公开主页与心声，生成你的灵魂档案',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ChunkLoadRecovery />
        {children}
      </body>
    </html>
  );
}
