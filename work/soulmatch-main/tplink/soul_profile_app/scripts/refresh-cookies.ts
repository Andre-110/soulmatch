import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const COOKIES_DIR = process.env.COOKIES_DIR || path.join(process.cwd(), '..', 'cookies');

function resolveChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return '/usr/bin/google-chrome';
}

type Platform = 'xhs' | 'douyin' | 'weibo' | 'netease' | 'douban' | 'zhihu';

const PLATFORM_CONFIG: Record<Platform, {
  name: string;
  cookieFile: string;
  url: string;
  keyCookies: string[];
}> = {
  xhs: {
    name: '小红书',
    cookieFile: 'cookies (6).json',
    url: 'https://www.xiaohongshu.com',
    keyCookies: ['web_session', 'webId', 'a1'],
  },
  douyin: {
    name: '抖音',
    cookieFile: 'cookies (20).json',
    url: 'https://www.douyin.com',
    keyCookies: ['sessionid', 'passport_csrf_token', 'sid_guard'],
  },
  weibo: {
    name: '微博',
    cookieFile: 'cookies (7).json',
    url: 'https://weibo.com',
    keyCookies: ['SUB', 'SUBP'],
  },
  netease: {
    name: '网易云音乐',
    cookieFile: 'cookies (9).json',
    url: 'https://music.163.com',
    keyCookies: ['MUSIC_U'],
  },
  douban: {
    name: '豆瓣',
    cookieFile: 'cookies (10).json',
    url: 'https://www.douban.com',
    keyCookies: ['dbcl2', 'bid'],
  },
  zhihu: {
    name: '知乎',
    cookieFile: 'cookies (11).json',
    url: 'https://www.zhihu.com',
    keyCookies: ['z_c0'],
  },
};

async function refreshCookies(platform: Platform): Promise<boolean> {
  const config = PLATFORM_CONFIG[platform];
  const cookieFile = path.join(COOKIES_DIR, config.cookieFile);

  console.log(`🔄 正在刷新 ${config.name} Cookie...`);
  console.log(`📁 Cookie 文件: ${cookieFile}`);

  // 检查 Cookie 文件是否存在
  if (!fs.existsSync(cookieFile)) {
    console.error(`❌ Cookie 文件不存在: ${cookieFile}`);
    console.error(`💡 请先运行登录脚本: npx tsx scripts/login-platform.ts ${platform}`);
    return false;
  }

  // 读取现有 Cookie
  let oldCookies;
  try {
    oldCookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
  } catch (error) {
    console.error('❌ Cookie 文件格式错误');
    return false;
  }

  console.log(`📊 旧 Cookie 数量: ${oldCookies.length}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveChromePath(),
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });

  // 注入旧 Cookie
  try {
    await context.addCookies(oldCookies);
  } catch (error) {
    console.error('❌ 注入 Cookie 失败:', error);
    await browser.close();
    return false;
  }

  const page = await context.newPage();

  console.log(`🌐 正在访问 ${config.url}...`);
  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 获取刷新后的 Cookie
  const newCookies = await context.cookies();

  // 检查关键 Cookie 是否存在
  const hasKeyCookies = config.keyCookies.some(key =>
    newCookies.some(c => c.name === key)
  );

  if (!hasKeyCookies) {
    console.error(`❌ Cookie 已失效，未找到关键 Cookie: ${config.keyCookies.join(', ')}`);
    console.error(`💡 需要重新登录: npx tsx scripts/login-platform.ts ${platform}`);
    await browser.close();
    return false;
  }

  // 备份旧 Cookie
  const backupFile = cookieFile + '.backup';
  fs.copyFileSync(cookieFile, backupFile);

  // 保存新 Cookie
  fs.writeFileSync(cookieFile, JSON.stringify(newCookies, null, 2));

  console.log(`✅ ${config.name} Cookie 刷新成功！`);
  console.log(`📊 新 Cookie 数量: ${newCookies.length}`);
  console.log(`🔑 关键 Cookie: ${newCookies.filter(c => config.keyCookies.includes(c.name)).map(c => c.name).join(', ')}`);
  console.log(`💾 已备份旧 Cookie 到: ${backupFile}`);

  await browser.close();
  return true;
}

async function refreshAll() {
  console.log('🔄 开始刷新所有平台 Cookie...\n');

  const platforms: Platform[] = ['xhs', 'douyin', 'weibo', 'netease', 'douban', 'zhihu'];
  const results: Record<string, boolean> = {};

  for (const platform of platforms) {
    try {
      results[platform] = await refreshCookies(platform);
    } catch (error) {
      console.error(`❌ ${PLATFORM_CONFIG[platform].name} 刷新失败:`, error);
      results[platform] = false;
    }
    console.log(''); // 空行分隔
  }

  // 输出总结
  console.log('═══════════════════════════════════════');
  console.log('           刷新结果汇总');
  console.log('═══════════════════════════════════════');

  for (const [platform, success] of Object.entries(results)) {
    const config = PLATFORM_CONFIG[platform as Platform];
    const status = success ? '✅ 成功' : '❌ 失败';
    console.log(`${config.name.padEnd(12)} ${status}`);
  }

  const successCount = Object.values(results).filter(Boolean).length;
  const totalCount = platforms.length;

  console.log('═══════════════════════════════════════');
  console.log(`成功: ${successCount}/${totalCount}`);
  console.log('═══════════════════════════════════════\n');

  return successCount === totalCount;
}

// 主函数
async function main() {
  const platform = process.argv[2];

  console.log('═══════════════════════════════════════');
  console.log('      Cookie 刷新工具');
  console.log('═══════════════════════════════════════\n');

  if (!platform) {
    console.log('用法: npx tsx scripts/refresh-cookies.ts <platform|all>');
    console.log('\n支持的平台:');
    console.log('  xhs     - 小红书');
    console.log('  douyin  - 抖音');
    console.log('  weibo   - 微博');
    console.log('  netease - 网易云音乐');
    console.log('  douban  - 豆瓣');
    console.log('  zhihu   - 知乎');
    console.log('  all     - 所有平台');
    console.log('\n示例:');
    console.log('  npx tsx scripts/refresh-cookies.ts xhs');
    console.log('  npx tsx scripts/refresh-cookies.ts all\n');
    process.exit(1);
  }

  let success = false;

  if (platform === 'all') {
    success = await refreshAll();
  } else if (platform in PLATFORM_CONFIG) {
    success = await refreshCookies(platform as Platform);
  } else {
    console.error('❌ 不支持的平台:', platform);
    console.log('支持的平台: xhs, douyin, weibo, netease, douban, zhihu, all');
    process.exit(1);
  }

  if (success) {
    console.log('🎉 Cookie 刷新完成！\n');
  } else {
    console.log('❌ Cookie 刷新失败\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ 发生错误:', error.message);
  process.exit(1);
});
