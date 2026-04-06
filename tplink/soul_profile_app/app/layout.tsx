import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery';
import { startResourceMonitoring } from '@/lib/resourceMonitor';

// 启动资源监控（仅在服务器端）
if (typeof window === 'undefined') {
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
      <head>
        {/* 在 React hydrate 之前捕获 ChunkLoadError，部署后浏览器缓存旧 HTML 时自动刷新一次 */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var KEY='sm_chunk_reload';
  function check(msg){return/ChunkLoadError|Loading chunk|Failed to load chunk|\\/_next\\/static\\/chunks/i.test(String(msg));}
  window.addEventListener('error',function(e){
    if(!check(e.message))return;
    if(sessionStorage.getItem(KEY)==='1')return;
    sessionStorage.setItem(KEY,'1');
    setTimeout(function(){sessionStorage.removeItem(KEY);},15000);
    window.location.reload();
  });
  window.addEventListener('unhandledrejection',function(e){
    var msg=e.reason&&e.reason.message||String(e.reason||'');
    if(!check(msg))return;
    if(sessionStorage.getItem(KEY)==='1')return;
    sessionStorage.setItem(KEY,'1');
    setTimeout(function(){sessionStorage.removeItem(KEY);},15000);
    e.preventDefault();
    window.location.reload();
  });
})();
        `}} />
      </head>
      <body suppressHydrationWarning>
        <ChunkLoadRecovery />
        {children}
      </body>
    </html>
  );
}
