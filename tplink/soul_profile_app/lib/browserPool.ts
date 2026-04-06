import { chromium, Browser, BrowserContext } from 'playwright-core';
import { resolveChromePath } from '@/lib/playwrightChrome';

/**
 * 浏览器实例池，复用 Chrome 进程，避免频繁启动/关闭
 */
class BrowserPool {
  private browser: Browser | null = null;
  private lastUsed: number = 0;
  private readonly IDLE_TIMEOUT = 300000; // 5 分钟无使用则关闭（批量截图需要更长时间）

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

// 定期清理空闲浏览器
const cleanupInterval = setInterval(() => {
  browserPool.cleanup().catch(console.error);
}, 30000); // 每 30 秒检查一次

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
