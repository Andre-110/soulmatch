import fs from 'fs';
import path from 'path';

const COOKIES_DIR = process.env.COOKIES_DIR || path.join(process.cwd(), '..', 'cookies');

type Platform = 'xhs' | 'douyin' | 'weibo' | 'netease' | 'douban' | 'zhihu';

const PLATFORM_CONFIG: Record<Platform, {
  name: string;
  cookieFile: string;
  keyCookies: string[];
  minCookieCount: number;
}> = {
  xhs: {
    name: '小红书',
    cookieFile: 'cookies (6).json',
    keyCookies: ['web_session', 'webId', 'a1'],
    minCookieCount: 5,
  },
  douyin: {
    name: '抖音',
    cookieFile: 'cookies (20).json',
    keyCookies: ['sessionid', 'passport_csrf_token', 'sid_guard'],
    minCookieCount: 5,
  },
  weibo: {
    name: '微博',
    cookieFile: 'cookies (7).json',
    keyCookies: ['SUB', 'SUBP'],
    minCookieCount: 3,
  },
  netease: {
    name: '网易云音乐',
    cookieFile: 'cookies (9).json',
    keyCookies: ['MUSIC_U'],
    minCookieCount: 3,
  },
  douban: {
    name: '豆瓣',
    cookieFile: 'cookies (10).json',
    keyCookies: ['dbcl2', 'bid'],
    minCookieCount: 3,
  },
  zhihu: {
    name: '知乎',
    cookieFile: 'cookies (11).json',
    keyCookies: ['z_c0'],
    minCookieCount: 3,
  },
};

type CookieHealth = {
  platform: Platform;
  name: string;
  exists: boolean;
  valid: boolean;
  cookieCount: number;
  missingKeyCookies: string[];
  expirationStatus: 'ok' | 'expiring-soon' | 'expired' | 'unknown';
  daysUntilExpiry?: number;
};

function checkCookieFile(platform: Platform): CookieHealth {
  const config = PLATFORM_CONFIG[platform];
  const cookieFile = path.join(COOKIES_DIR, config.cookieFile);

  const result: CookieHealth = {
    platform,
    name: config.name,
    exists: false,
    valid: false,
    cookieCount: 0,
    missingKeyCookies: [],
    expirationStatus: 'unknown',
  };

  // 检查文件是否存在
  if (!fs.existsSync(cookieFile)) {
    return result;
  }

  result.exists = true;

  // 读取并解析 Cookie
  let cookies;
  try {
    const content = fs.readFileSync(cookieFile, 'utf-8');
    cookies = JSON.parse(content);
  } catch (error) {
    return result;
  }

  if (!Array.isArray(cookies)) {
    return result;
  }

  result.cookieCount = cookies.length;

  // 检查关键 Cookie
  const presentKeyCookies = config.keyCookies.filter(key =>
    cookies.some((c: any) => c.name === key)
  );

  result.missingKeyCookies = config.keyCookies.filter(
    key => !presentKeyCookies.includes(key)
  );

  // 检查 Cookie 数量和关键 Cookie
  const hasEnoughCookies = cookies.length >= config.minCookieCount;
  const hasAllKeyCookies = result.missingKeyCookies.length === 0;

  result.valid = hasEnoughCookies && hasAllKeyCookies;

  // 检查过期时间
  const now = Date.now() / 1000; // 转换为秒
  const expiringCookies = cookies.filter((c: any) => {
    if (!c.expirationDate && !c.expires) return false;
    const expiry = c.expirationDate || c.expires;
    return expiry > now && expiry < now + 7 * 24 * 60 * 60; // 7天内过期
  });

  const expiredCookies = cookies.filter((c: any) => {
    if (!c.expirationDate && !c.expires) return false;
    const expiry = c.expirationDate || c.expires;
    return expiry <= now;
  });

  if (expiredCookies.length > 0) {
    result.expirationStatus = 'expired';
  } else if (expiringCookies.length > 0) {
    result.expirationStatus = 'expiring-soon';
    // 计算最近的过期时间
    const minExpiry = Math.min(...expiringCookies.map((c: any) => c.expirationDate || c.expires));
    result.daysUntilExpiry = Math.floor((minExpiry - now) / (24 * 60 * 60));
  } else {
    result.expirationStatus = 'ok';
  }

  return result;
}

function printHealthReport(health: CookieHealth) {
  const statusIcon = health.valid ? '✅' : '❌';
  const expiryIcon = {
    'ok': '🟢',
    'expiring-soon': '🟡',
    'expired': '🔴',
    'unknown': '⚪',
  }[health.expirationStatus];

  console.log(`\n${statusIcon} ${health.name}`);
  console.log(`   文件存在: ${health.exists ? '✓' : '✗'}`);
  console.log(`   Cookie 数量: ${health.cookieCount}`);

  if (health.missingKeyCookies.length > 0) {
    console.log(`   缺失关键 Cookie: ${health.missingKeyCookies.join(', ')}`);
  } else if (health.exists) {
    console.log(`   关键 Cookie: ✓`);
  }

  console.log(`   ${expiryIcon} 过期状态: ${
    health.expirationStatus === 'ok' ? '正常' :
    health.expirationStatus === 'expiring-soon' ? `即将过期 (${health.daysUntilExpiry}天)` :
    health.expirationStatus === 'expired' ? '已过期' :
    '未知'
  }`);

  if (!health.valid) {
    console.log(`   💡 建议: npx tsx scripts/login-platform.ts ${health.platform}`);
  } else if (health.expirationStatus === 'expiring-soon') {
    console.log(`   💡 建议: npx tsx scripts/refresh-cookies.ts ${health.platform}`);
  } else if (health.expirationStatus === 'expired') {
    console.log(`   💡 建议: npx tsx scripts/login-platform.ts ${health.platform}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('      Cookie 健康检查报告');
  console.log('═══════════════════════════════════════');
  console.log(`📂 Cookie 目录: ${COOKIES_DIR}\n`);

  const platforms: Platform[] = ['xhs', 'douyin', 'weibo', 'netease', 'douban', 'zhihu'];
  const healthReports: CookieHealth[] = [];

  for (const platform of platforms) {
    const health = checkCookieFile(platform);
    healthReports.push(health);
    printHealthReport(health);
  }

  // 总结
  console.log('\n═══════════════════════════════════════');
  console.log('              总结');
  console.log('═══════════════════════════════════════');

  const validCount = healthReports.filter(h => h.valid).length;
  const totalCount = healthReports.length;
  const expiringCount = healthReports.filter(h => h.expirationStatus === 'expiring-soon').length;
  const expiredCount = healthReports.filter(h => h.expirationStatus === 'expired').length;

  console.log(`✅ 有效: ${validCount}/${totalCount}`);
  console.log(`🟡 即将过期: ${expiringCount}`);
  console.log(`🔴 已过期: ${expiredCount}`);

  if (validCount === totalCount && expiringCount === 0 && expiredCount === 0) {
    console.log('\n🎉 所有 Cookie 状态良好！');
  } else if (expiredCount > 0) {
    console.log('\n⚠️  有 Cookie 已过期，需要重新登录');
  } else if (expiringCount > 0) {
    console.log('\n⚠️  有 Cookie 即将过期，建议刷新');
  } else {
    console.log('\n⚠️  有 Cookie 无效，需要登录');
  }

  console.log('\n💡 快速操作:');
  console.log('   登录所有平台: 依次运行 login-platform.ts');
  console.log('   刷新所有平台: npx tsx scripts/refresh-cookies.ts all');
  console.log('   查看帮助: npx tsx scripts/check-cookie-health.ts --help\n');

  // 返回状态码
  const hasIssues = validCount < totalCount || expiredCount > 0;
  process.exit(hasIssues ? 1 : 0);
}

// 检查是否需要帮助
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Cookie 健康检查工具\n');
  console.log('用法: npx tsx scripts/check-cookie-health.ts\n');
  console.log('功能:');
  console.log('  - 检查所有平台的 Cookie 文件是否存在');
  console.log('  - 验证关键 Cookie 是否完整');
  console.log('  - 检查 Cookie 过期状态');
  console.log('  - 提供修复建议\n');
  console.log('退出码:');
  console.log('  0 - 所有 Cookie 正常');
  console.log('  1 - 有 Cookie 无效或过期\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ 发生错误:', error.message);
  process.exit(1);
});
