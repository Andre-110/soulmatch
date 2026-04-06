import { chromium, Browser, BrowserContext } from 'playwright-core';
import { resolveChromePath } from '@/lib/playwrightChrome';

/**
 * 浏览器实例池，复用 Chrome 进程，避免频繁启动/关闭
 */
class BrowserPool {
  private browser: Browser | null = null;
  private lastUsed: number = 0;
  private readonly IDLE_TIMEOUT = 180000; // 3 分钟无使用则关闭，减轻常驻内存

  async getBrowser(): Promise<Browser> {
    // 如果浏览器不存在或已断开，重新启动
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[BrowserPool] 启动新的 Chrome 实例...');
      this.browser = await chromium.launch({
        executablePath: resolveChromePath(),
        headless: true,
        timeout: 60000, // 60秒启动超时
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--renderer-process-limit=2',
        ],
      });
    }
    this.lastUsed = Date.now();
    return this.browser;
  }

  async cleanup() {
    if (this.browser && Date.now() - this.lastUsed > this.IDLE_TIMEOUT) {
      console.log('[BrowserPool] 清理空闲浏览器实例...');
      await this.browser.close();
      this.browser = null;
    }
  }

  async forceClose() {
    if (this.browser) {
      console.log('[BrowserPool] 强制关闭浏览器实例...');
      await this.browser.close();
      this.browser = null;
    }
  }

  isActive(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}

export const browserPool = new BrowserPool();

// 定期清理空闲浏览器（间隔拉长，减轻小内存机器上的定时器与 Playwright 压力）
const cleanupInterval = setInterval(() => {
  browserPool.cleanup().catch(console.error);
}, 180_000);

// 进程退出时清理
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    clearInterval(cleanupInterval);
    browserPool.forceClose().catch(console.error);
  });

  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
    browserPool.forceClose().catch(console.error);
  });

  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    browserPool.forceClose().catch(console.error);
  });
}
