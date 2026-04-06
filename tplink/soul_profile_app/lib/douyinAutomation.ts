import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

/**
 * 使用 playwright 自动化抖音搜索
 * 1. 加载 cookie 登录抖音
 * 2. 点击搜索框
 * 3. 搜索用户 ID
 * 4. 进入用户主页并获取数据
 */

export async function searchDouyinUser(userId: string): Promise<{
  success: boolean;
  profileUrl?: string;
  error?: string;
}> {
  let browser;
  try {
    // 读取 cookie
    const cookiePath = path.join(process.cwd(), 'lib/cookies/douyin.json');
    if (!fs.existsSync(cookiePath)) {
      return { success: false, error: 'Cookie 文件不存在' };
    }
    const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));

    // 启动浏览器
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // 注入 cookie
    await context.addCookies(cookies);

    const page = await context.newPage();

    // 访问抖音首页
    await page.goto('https://www.douyin.com/', { waitUntil: 'networkidle', timeout: 30000 });

    // 等待搜索框出现并点击
    await page.waitForSelector('input[placeholder*="搜索"]', { timeout: 10000 });
    await page.click('input[placeholder*="搜索"]');

    // 输入用户 ID
    await page.fill('input[placeholder*="搜索"]', userId);
    await page.keyboard.press('Enter');

    // 等待搜索结果加载
    await page.waitForTimeout(3000);

    // 尝试点击用户标签页
    const userTab = page.locator('text=用户').first();
    if (await userTab.isVisible()) {
      await userTab.click();
      await page.waitForTimeout(2000);
    }

    // 获取第一个用户结果并点击
    const firstUser = page.locator('[data-e2e="search-user-item"]').first();
    if (await firstUser.isVisible()) {
      await firstUser.click();
      await page.waitForTimeout(2000);

      const profileUrl = page.url();
      await browser.close();

      return {
        success: true,
        profileUrl,
      };
    }

    await browser.close();
    return { success: false, error: '未找到用户' };
  } catch (error) {
    if (browser) await browser.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : '自动化搜索失败',
    };
  }
}
