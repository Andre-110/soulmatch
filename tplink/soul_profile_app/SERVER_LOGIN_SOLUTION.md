# 服务器端登录小红书/抖音账号方案

## 当前实现分析

### 现状
目前系统使用 **Cookie 文件** 来访问平台数据：
- 小红书：`cookies (6).json`
- 抖音：`cookies (8).json`
- 其他平台：微博、网易云、豆瓣、知乎

### Cookie 工作原理
```
1. 手动在浏览器登录平台
2. 使用浏览器插件导出 Cookie
3. 保存到 /home/ecs-user/cookies/ 目录
4. 服务器读取 Cookie 文件
5. 使用 Cookie 访问平台 API/页面
```

### 当前问题
- ❌ Cookie 会过期（1-3个月）
- ❌ 需要手动更新
- ❌ 每次过期都要重新导出

## 你的需求

**目标**：在服务器上登录一个小红书/抖音账号，这样用户提供 ID 就能搜索到主页信息。

## 解决方案

### 方案 1：自动化登录 + Cookie 持久化（推荐）

使用 Playwright 自动化登录，保存 Cookie 到文件，定期刷新。

#### 优点
- ✅ 一次登录，长期使用
- ✅ Cookie 自动刷新
- ✅ 可以定时检查并重新登录
- ✅ 支持多账号

#### 实现步骤

**1. 创建登录脚本**

```typescript
// scripts/login-platform.ts
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const COOKIES_DIR = process.env.COOKIES_DIR || path.join(process.cwd(), '..', 'cookies');

async function loginXiaohongshu() {
  console.log('🚀 启动小红书登录流程...');
  
  const browser = await chromium.launch({
    headless: false, // 显示浏览器，方便扫码/输入验证码
    executablePath: '/usr/bin/google-chrome',
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  
  const page = await context.newPage();
  
  // 访问小红书
  await page.goto('https://www.xiaohongshu.com');
  
  console.log('📱 请在浏览器中完成登录（扫码或输入验证码）...');
  console.log('⏳ 登录完成后，按回车键继续...');
  
  // 等待用户手动登录
  await waitForEnter();
  
  // 验证是否登录成功
  await page.waitForTimeout(2000);
  const isLoggedIn = await page.evaluate(() => {
    return document.cookie.includes('web_session');
  });
  
  if (!isLoggedIn) {
    console.error('❌ 登录失败，未检测到登录 Cookie');
    await browser.close();
    return;
  }
  
  // 保存 Cookie
  const cookies = await context.cookies();
  const cookieFile = path.join(COOKIES_DIR, 'cookies (6).json');
  fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
  
  console.log('✅ Cookie 已保存到:', cookieFile);
  console.log('📊 Cookie 数量:', cookies.length);
  
  await browser.close();
}

async function loginDouyin() {
  console.log('🚀 启动抖音登录流程...');
  
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome',
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  
  const page = await context.newPage();
  
  // 访问抖音
  await page.goto('https://www.douyin.com');
  
  console.log('📱 请在浏览器中完成登录（扫码或输入验证码）...');
  console.log('⏳ 登录完成后，按回车键继续...');
  
  await waitForEnter();
  
  // 验证登录
  await page.waitForTimeout(2000);
  const isLoggedIn = await page.evaluate(() => {
    return document.cookie.includes('sessionid') || document.cookie.includes('passport_csrf_token');
  });
  
  if (!isLoggedIn) {
    console.error('❌ 登录失败');
    await browser.close();
    return;
  }
  
  // 保存 Cookie
  const cookies = await context.cookies();
  const cookieFile = path.join(COOKIES_DIR, 'cookies (8).json');
  fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
  
  console.log('✅ Cookie 已保存到:', cookieFile);
  console.log('📊 Cookie 数量:', cookies.length);
  
  await browser.close();
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
  
  if (!platform) {
    console.log('用法: npx tsx scripts/login-platform.ts <platform>');
    console.log('支持的平台: xhs, douyin');
    process.exit(1);
  }
  
  switch (platform) {
    case 'xhs':
      await loginXiaohongshu();
      break;
    case 'douyin':
      await loginDouyin();
      break;
    default:
      console.error('不支持的平台:', platform);
      process.exit(1);
  }
}

main().catch(console.error);
```

**2. 使用方法**

```bash
# 登录小红书
npx tsx scripts/login-platform.ts xhs

# 登录抖音
npx tsx scripts/login-platform.ts douyin
```

**3. 创建 Cookie 刷新脚本**

```typescript
// scripts/refresh-cookies.ts
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const COOKIES_DIR = process.env.COOKIES_DIR || path.join(process.cwd(), '..', 'cookies');

async function refreshCookies(platform: 'xhs' | 'douyin') {
  const cookieFiles = {
    xhs: 'cookies (6).json',
    douyin: 'cookies (8).json',
  };
  
  const urls = {
    xhs: 'https://www.xiaohongshu.com',
    douyin: 'https://www.douyin.com',
  };
  
  const cookieFile = path.join(COOKIES_DIR, cookieFiles[platform]);
  
  // 读取现有 Cookie
  if (!fs.existsSync(cookieFile)) {
    console.error('❌ Cookie 文件不存在:', cookieFile);
    return false;
  }
  
  const oldCookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
  });
  
  const context = await browser.newContext();
  
  // 注入旧 Cookie
  await context.addCookies(oldCookies);
  
  const page = await context.newPage();
  await page.goto(urls[platform]);
  await page.waitForTimeout(3000);
  
  // 检查是否仍然登录
  const isLoggedIn = await page.evaluate(() => {
    return document.cookie.length > 100; // 简单检查
  });
  
  if (!isLoggedIn) {
    console.error('❌ Cookie 已失效，需要重新登录');
    await browser.close();
    return false;
  }
  
  // 获取刷新后的 Cookie
  const newCookies = await context.cookies();
  
  // 保存新 Cookie
  fs.writeFileSync(cookieFile, JSON.stringify(newCookies, null, 2));
  
  console.log('✅ Cookie 已刷新:', platform);
  console.log('📊 Cookie 数量:', newCookies.length);
  
  await browser.close();
  return true;
}

async function main() {
  const platform = process.argv[2] as 'xhs' | 'douyin';
  
  if (!platform || !['xhs', 'douyin'].includes(platform)) {
    console.log('用法: npx tsx scripts/refresh-cookies.ts <platform>');
    console.log('支持的平台: xhs, douyin');
    process.exit(1);
  }
  
  const success = await refreshCookies(platform);
  process.exit(success ? 0 : 1);
}

main().catch(console.error);
```

**4. 设置定时刷新（Cron）**

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 3 点刷新）
0 3 * * * cd /home/ecs-user/tplink-app/tplink/soul_profile_app && npx tsx scripts/refresh-cookies.ts xhs >> /tmp/cookie-refresh.log 2>&1
0 3 * * * cd /home/ecs-user/tplink-app/tplink/soul_profile_app && npx tsx scripts/refresh-cookies.ts douyin >> /tmp/cookie-refresh.log 2>&1
```

### 方案 2：使用无头浏览器 + Session 池

维护一个浏览器 Session 池，保持登录状态。

#### 优点
- ✅ 不需要频繁刷新 Cookie
- ✅ Session 一直保持活跃
- ✅ 更稳定

#### 缺点
- ❌ 占用更多资源（内存）
- ❌ 实现复杂度高

### 方案 3：使用官方 API（如果有）

某些平台提供开发者 API。

#### 小红书
- ❌ 没有公开的官方 API
- ⚠️ 只能通过 Cookie 访问

#### 抖音
- ✅ 有开放平台：https://open.douyin.com/
- ⚠️ 需要企业认证
- ⚠️ 有调用限制

## 推荐方案

### 最佳实践：方案 1（自动化登录 + Cookie 持久化）

**实施步骤**：

1. **初次登录**
   ```bash
   npx tsx scripts/login-platform.ts xhs
   npx tsx scripts/login-platform.ts douyin
   ```

2. **验证 Cookie**
   ```bash
   # 测试小红书
   npx tsx scripts/test-xhs-scrape.ts
   
   # 测试抖音
   npx tsx scripts/test-douyin-scrape.ts
   ```

3. **设置自动刷新**
   ```bash
   # 每天自动刷新 Cookie
   crontab -e
   ```

4. **监控 Cookie 状态**
   ```typescript
   // 在应用中添加 Cookie 健康检查
   // lib/cookieHealthCheck.ts
   ```

## 安全注意事项

1. **Cookie 安全**
   - ⚠️ Cookie 包含登录凭证，不要泄露
   - ⚠️ 不要提交到 Git
   - ⚠️ 设置文件权限：`chmod 600 cookies/*.json`

2. **账号安全**
   - 建议使用专门的测试账号
   - 不要使用个人主账号
   - 定期检查账号登录记录

3. **风控问题**
   - 频繁请求可能触发风控
   - 建议添加请求间隔
   - 使用真实的 User-Agent

## 下一步

需要我帮你创建这些登录脚本吗？我可以：

1. ✅ 创建 `scripts/login-platform.ts`（自动化登录）
2. ✅ 创建 `scripts/refresh-cookies.ts`（Cookie 刷新）
3. ✅ 创建 `scripts/check-cookie-health.ts`（健康检查）
4. ✅ 更新文档说明使用方法
