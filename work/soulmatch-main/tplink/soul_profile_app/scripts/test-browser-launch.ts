import { chromium } from 'playwright-core';

async function testBrowserLaunch() {
  console.log('🚀 测试 Chrome 启动...');
  console.log('时间:', new Date().toISOString());

  const startTime = Date.now();

  try {
    console.log('正在启动 Chrome...');
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      timeout: 60000, // 60秒超时
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const launchTime = Date.now() - startTime;
    console.log(`✅ Chrome 启动成功！耗时: ${launchTime}ms`);

    console.log('正在创建页面...');
    const page = await browser.newPage();
    console.log('✅ 页面创建成功');

    console.log('正在访问测试页面...');
    await page.goto('https://www.baidu.com', { timeout: 30000 });
    console.log('✅ 页面加载成功');

    const title = await page.title();
    console.log('页面标题:', title);

    await browser.close();
    console.log('✅ 浏览器已关闭');

    const totalTime = Date.now() - startTime;
    console.log(`\n总耗时: ${totalTime}ms`);

  } catch (error: any) {
    const failTime = Date.now() - startTime;
    console.error(`❌ 失败！耗时: ${failTime}ms`);
    console.error('错误:', error.message);
    throw error;
  }
}

testBrowserLaunch().catch(console.error);
