/**
 * Playwright 使用本机 Chrome 时的路径与通用启动参数（与 screenshot / 小红书脚本一致）。
 */
export function resolveChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return '/usr/bin/google-chrome';
}

/** 无 root / CI / 容器环境常见所需，同时移除 Automation 特征降低反爬检测概率 */
export const CHROME_HEADLESS_BASE_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  // 移除 AutomationControlled 特征（XHS/抖音等平台会检测该标志）
  '--disable-blink-features=AutomationControlled',
  // 避免 headless-specific 指纹
  '--disable-features=IsolateOrigins',
  '--disable-site-isolation-trials',
] as const;
