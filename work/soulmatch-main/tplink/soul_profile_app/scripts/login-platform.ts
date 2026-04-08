import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const COOKIES_DIR = process.env.COOKIES_DIR || path.join(process.cwd(), '..', 'cookies');

function resolveChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return '/usr/bin/google-chrome';
}

async function loginXiaohongshu() {
  console.log('🚀 启动小红书登录流程...');
  console.log('📂 Cookie 保存目录:', COOKIES_DIR);

  const browser = await chromium.launch({
    headless: false, // 显示浏览器，方便扫码/输入验证码
    executablePath: resolveChromePath(),
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log('🌐 正在打开小红书...');
  await page.goto('https://www.xiaohongshu.com');
  await page.waitForTimeout(2000);

  console.log('\n📱 请在浏览器中完成登录：');
  console.log('   1. 点击右上角"登录"按钮');
  console.log('   2. 选择登录方式（扫码/手机号）');
  console.log('   3. 完成登录验证');
  console.log('   4. 确认能看到个人主页');
  console.log('\n⏳ 登录完成后，按回车键继续...\n');

  // 等待用户手动登录
  await waitForEnter();

  // 验证是否登录成功
  console.log('🔍 正在验证登录状态...');
  await page.waitForTimeout(2000);

  const cookies = await context.cookies();
  const hasWebSession = cookies.some(c => c.name === 'web_session' || c.name === 'webId');

  if (!hasWebSession || cookies.length < 5) {
    console.error('❌ 登录失败，未检测到有效的登录 Cookie');
    console.error('💡 提示：请确保已完成登录并能看到个人主页');
    await browser.close();
    return false;
  }

  // 保存 Cookie
  if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
  }

  const cookieFile = path.join(COOKIES_DIR, 'cookies (6).json');

  // 备份旧 Cookie
  if (fs.existsSync(cookieFile)) {
    const backupFile = cookieFile + '.backup';
    fs.copyFileSync(cookieFile, backupFile);
    console.log('💾 已备份旧 Cookie 到:', backupFile);
  }

  fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));

  console.log('\n✅ 小红书登录成功！');
  console.log('📁 Cookie 已保存到:', cookieFile);
  console.log('📊 Cookie 数量:', cookies.length);
  console.log('🔑 关键 Cookie:', cookies.filter(c => ['web_session', 'webId', 'a1'].includes(c.name)).map(c => c.name).join(', '));

  await browser.close();
  return true;
}

async function loginDouyin() {
  console.log('🚀 启动抖音登录流程...');
  console.log('📂 Cookie 保存目录:', COOKIES_DIR);

  const browser = await chromium.launch({
    headless: false,
    executablePath: resolveChromePath(),
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log('🌐 正在打开抖音...');
  await page.goto('https://www.douyin.com');
  await page.waitForTimeout(2000);

  console.log('\n📱 请在浏览器中完成登录：');
  console.log('   1. 点击右上角"登录"按钮');
  console.log('   2. 选择登录方式（扫码/手机号）');
  console.log('   3. 完成登录验证');
  console.log('   4. 确认能看到个人主页');
  console.log('\n⏳ 登录完成后，按回车键继续...\n');

  await waitForEnter();

  // 验证登录
  console.log('🔍 正在验证登录状态...');
  await page.waitForTimeout(2000);

  const cookies = await context.cookies();
  const hasSession = cookies.some(c =>
    c.name === 'sessionid' ||
    c.name === 'passport_csrf_token' ||
    c.name === 'sid_guard'
  );

  if (!hasSession || cookies.length < 5) {
    console.error('❌ 登录失败，未检测到有效的登录 Cookie');
    console.error('💡 提示：请确保已完成登录并能看到个人主页');
    await browser.close();
    return false;
  }

  // 保存 Cookie
  if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
  }

  const cookieFile = path.join(COOKIES_DIR, 'cookies (20).json');

  // 备份旧 Cookie
  if (fs.existsSync(cookieFile)) {
    const backupFile = cookieFile + '.backup';
    fs.copyFileSync(cookieFile, backupFile);
    console.log('💾 已备份旧 Cookie 到:', backupFile);
  }

  fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));

  console.log('\n✅ 抖音登录成功！');
  console.log('📁 Cookie 已保存到:', cookieFile);
  console.log('📊 Cookie 数量:', cookies.length);
  console.log('🔑 关键 Cookie:', cookies.filter(c => ['sessionid', 'passport_csrf_token', 'sid_guard'].includes(c.name)).map(c => c.name).join(', '));

  await browser.close();
  return true;
}

function waitForEnter(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

// 主函数
async function main() {
  const platform = process.argv[2];

  console.log('═══════════════════════════════════════');
  console.log('   平台登录工具 - Cookie 自动保存');
  console.log('═══════════════════════════════════════\n');

  if (!platform) {
    console.log('用法: npx tsx scripts/login-platform.ts <platform>');
    console.log('\n支持的平台:');
    console.log('  xhs     - 小红书');
    console.log('  douyin  - 抖音');
    console.log('\n示例:');
    console.log('  npx tsx scripts/login-platform.ts xhs');
    console.log('  npx tsx scripts/login-platform.ts douyin\n');
    process.exit(1);
  }

  let success = false;

  switch (platform) {
    case 'xhs':
      success = await loginXiaohongshu();
      break;
    case 'douyin':
      success = await loginDouyin();
      break;
    default:
      console.error('❌ 不支持的平台:', platform);
      console.log('支持的平台: xhs, douyin');
      process.exit(1);
  }

  if (success) {
    console.log('\n🎉 登录流程完成！');
    console.log('💡 提示：Cookie 通常有效期 1-3 个月，过期后需要重新登录');
    console.log('💡 建议：设置定时任务自动刷新 Cookie（见文档）\n');
  } else {
    console.log('\n❌ 登录流程失败，请重试\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ 发生错误:', error.message);
  process.exit(1);
});
