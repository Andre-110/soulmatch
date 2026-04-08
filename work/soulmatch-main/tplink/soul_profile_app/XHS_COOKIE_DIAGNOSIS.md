# 小红书 Cookie 问题诊断报告

## 问题现象

✅ Cookie 文件存在且格式正确
✅ 包含关键 Cookie（web_session, a1）
❌ 但访问页面仍显示"登录"状态

## 详细分析

### Cookie 信息
- **文件位置**: `/home/ecs-user/tplink-app/cookies (13).json`
- **Cookie 数量**: 14 个
- **Cookie Header 长度**: 736 字符
- **关键 Cookie**:
  - `web_session`: `0400698efe9846560a0a234be43b4b890a5cfb`
  - `a1`: `19b7dd72589raof6ipqdzxcur2usdqrcs7rx6gazz300002099`

### 测试结果
1. **HTTP 请求**: 200 OK
2. **响应长度**: 580KB（正常）
3. **登录状态**: ❌ 未登录（页面包含"登录"文字）
4. **API 抓取**: ❌ 失败（返回空数据）

## 根本原因

**Cookie 已过期或被小红书服务器拒绝**

可能的原因：
1. Cookie 导出时账号未完全登录
2. Cookie 导出后立即失效
3. 小红书检测到异常访问模式
4. IP 地址变化导致 Cookie 失效
5. 需要额外的安全验证

## 解决方案

### 方案 1：重新导出 Cookie（推荐）

**步骤**：
1. 清除浏览器缓存和 Cookie
2. 重新访问 https://www.xiaohongshu.com
3. 完整登录（不要使用"记住我"）
4. 登录后浏览几个页面（确保会话激活）
5. 使用 EditThisCookie 导出
6. 立即测试验证

**验证方法**：
```bash
# 导出后立即在浏览器中测试
# 1. 打开开发者工具（F12）
# 2. 切换到 Console 标签
# 3. 输入并执行：
document.cookie

# 应该看到完整的 Cookie 字符串
# 如果看到 web_session 和 a1，说明登录有效
```

### 方案 2：使用持久化浏览器上下文

修改代码，让浏览器保持登录状态：

```typescript
// 首次运行时手动登录
const context = await chromium.launchPersistentContext('./user-data-xhs', {
  headless: false,  // 显示浏览器
  viewport: { width: 1280, height: 720 },
});

// 首次运行：人工登录
// 后续运行：自动保持登录
```

### 方案 3：使用 Playwright 的 storageState

```typescript
// 1. 首次登录并保存状态
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://www.xiaohongshu.com');
// 人工登录...
await context.storageState({ path: 'xhs-auth.json' });

// 2. 后续使用保存的状态
const context = await browser.newContext({
  storageState: 'xhs-auth.json'
});
```

### 方案 4：检查 Cookie 域名和路径

确保 Cookie 的域名设置正确：

```json
{
  "domain": ".xiaohongshu.com",  // 必须以 . 开头
  "path": "/",
  "secure": true,  // 小红书可能要求 HTTPS
  "httpOnly": false
}
```

## 临时解决方案

如果无法获取有效 Cookie，可以：

1. **只使用截图功能**
   - 跳过 API 抓取
   - 直接截图用户主页
   - 让 GPT-4o 视觉分析

2. **降级到公开数据**
   - 只抓取不需要登录的公开信息
   - 使用第三方 API（如果有）

## 测试命令

### 快速验证 Cookie 是否有效

```bash
# 方法 1：使用 curl
curl -H "Cookie: $(cat '/home/ecs-user/tplink-app/cookies (13).json' | jq -r '.[] | "\(.name)=\(.value)"' | paste -sd ';')" \
  https://www.xiaohongshu.com | grep -o "登录"

# 如果输出"登录"，说明 Cookie 无效
# 如果无输出，说明 Cookie 可能有效

# 方法 2：运行调试脚本
npx tsx test-xhs-debug.ts
```

## 下一步行动

### 立即执行
1. ✅ 在浏览器中重新登录小红书
2. ✅ 确保能正常浏览页面
3. ✅ 使用 EditThisCookie 导出
4. ✅ 保存到 `/home/ecs-user/tplink-app/cookies (13).json`
5. ✅ 运行 `npx tsx test-xhs-debug.ts` 验证

### 验证成功的标志
```
包含"登录": ✅ 否（已登录）  # 这个必须是 ✅
抓取状态: ✅               # 这个必须是 ✅
```

## 重要提示

⚠️ **小红书的反爬机制很严格**

- Cookie 可能随时失效
- 需要定期更新（建议每周检查）
- 频繁访问可能触发风控
- 建议使用真实的个人账号
- 不要使用新注册的账号

## 备选方案

如果 Cookie 方式持续失败，考虑：

1. **使用小红书开放平台 API**（如果有）
2. **使用第三方数据服务**
3. **只依赖截图 + GPT-4o 视觉分析**
4. **联系小红书申请数据接口**

---

**当前状态**: Cookie 无效，需要重新获取有效的登录 Cookie
