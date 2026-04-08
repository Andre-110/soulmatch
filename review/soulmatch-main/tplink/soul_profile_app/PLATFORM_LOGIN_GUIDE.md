# 服务器端平台登录完整指南

## 📋 概述

本指南提供了在服务器上登录小红书、抖音等平台账号的完整解决方案，让你可以通过用户 ID 自动获取他们的主页信息。

## 🎯 目标

- ✅ 在服务器上登录平台账号
- ✅ 自动保存和刷新 Cookie
- ✅ 用户提供 ID 即可获取主页数据
- ✅ Cookie 健康监控和自动维护

## 📦 已创建的工具

### 1. 登录工具 (`scripts/login-platform.ts`)

**功能**：自动化登录平台并保存 Cookie

**支持平台**：
- 小红书 (xhs)
- 抖音 (douyin)

**使用方法**：
```bash
# 登录小红书
npx tsx scripts/login-platform.ts xhs

# 登录抖音
npx tsx scripts/login-platform.ts douyin
```

**工作流程**：
1. 启动浏览器（非无头模式）
2. 打开平台登录页面
3. 等待你手动完成登录（扫码/验证码）
4. 按回车键确认
5. 自动保存 Cookie 到文件
6. 备份旧 Cookie

### 2. Cookie 刷新工具 (`scripts/refresh-cookies.ts`)

**功能**：使用现有 Cookie 访问平台，刷新 Cookie 延长有效期

**支持平台**：
- 小红书 (xhs)
- 抖音 (douyin)
- 微博 (weibo)
- 网易云音乐 (netease)
- 豆瓣 (douban)
- 知乎 (zhihu)

**使用方法**：
```bash
# 刷新单个平台
npx tsx scripts/refresh-cookies.ts xhs

# 刷新所有平台
npx tsx scripts/refresh-cookies.ts all
```

**工作流程**：
1. 读取现有 Cookie 文件
2. 启动无头浏览器
3. 注入 Cookie
4. 访问平台页面
5. 获取刷新后的 Cookie
6. 验证关键 Cookie 是否存在
7. 保存新 Cookie（备份旧的）

### 3. Cookie 健康检查工具 (`scripts/check-cookie-health.ts`)

**功能**：检查所有平台 Cookie 的健康状态

**使用方法**：
```bash
npx tsx scripts/check-cookie-health.ts
```

**检查项目**：
- ✅ Cookie 文件是否存在
- ✅ Cookie 数量是否足够
- ✅ 关键 Cookie 是否完整
- ✅ Cookie 是否过期或即将过期

**输出示例**：
```
═══════════════════════════════════════
      Cookie 健康检查报告
═══════════════════════════════════════
📂 Cookie 目录: /home/ecs-user/cookies/

✅ 小红书
   文件存在: ✓
   Cookie 数量: 28
   关键 Cookie: ✓
   🟢 过期状态: 正常

❌ 抖音
   文件存在: ✓
   Cookie 数量: 45
   缺失关键 Cookie: sessionid
   🔴 过期状态: 已过期
   💡 建议: npx tsx scripts/login-platform.ts douyin

═══════════════════════════════════════
              总结
═══════════════════════════════════════
✅ 有效: 5/6
🟡 即将过期: 0
🔴 已过期: 1
```

## 🚀 快速开始

### 第一次使用

1. **登录小红书**
   ```bash
   cd /home/ecs-user/tplink-app/tplink/soul_profile_app
   npx tsx scripts/login-platform.ts xhs
   ```
   - 浏览器会自动打开
   - 在浏览器中完成登录
   - 按回车键保存 Cookie

2. **登录抖音**
   ```bash
   npx tsx scripts/login-platform.ts douyin
   ```

3. **检查 Cookie 状态**
   ```bash
   npx tsx scripts/check-cookie-health.ts
   ```

4. **测试是否工作**
   ```bash
   # 测试小红书
   npm run dev
   # 访问 http://localhost:3000?debug=1
   # 完成建档流程，查看是否能正常抓取数据
   ```

### 日常维护

**每天自动刷新 Cookie**（推荐）

编辑 crontab：
```bash
crontab -e
```

添加以下行：
```bash
# 每天凌晨 3 点刷新所有平台 Cookie
0 3 * * * cd /home/ecs-user/tplink-app/tplink/soul_profile_app && npx tsx scripts/refresh-cookies.ts all >> /tmp/cookie-refresh.log 2>&1

# 每天早上 9 点检查 Cookie 健康状态
0 9 * * * cd /home/ecs-user/tplink-app/tplink/soul_profile_app && npx tsx scripts/check-cookie-health.ts >> /tmp/cookie-health.log 2>&1
```

**手动刷新**（当 Cookie 即将过期时）
```bash
npx tsx scripts/refresh-cookies.ts all
```

**重新登录**（当 Cookie 完全失效时）
```bash
npx tsx scripts/login-platform.ts xhs
npx tsx scripts/login-platform.ts douyin
```

## 📁 文件结构

```
/home/ecs-user/
├── cookies/                          # Cookie 存储目录
│   ├── cookies (6).json             # 小红书
│   ├── cookies (6).json.backup      # 小红书备份
│   ├── cookies (8).json             # 抖音
│   ├── cookies (8).json.backup      # 抖音备份
│   ├── cookies (7).json             # 微博
│   ├── cookies (9).json             # 网易云
│   ├── cookies (10).json            # 豆瓣
│   └── cookies (11).json            # 知乎
│
└── tplink-app/tplink/soul_profile_app/
    └── scripts/
        ├── login-platform.ts         # 登录工具
        ├── refresh-cookies.ts        # 刷新工具
        └── check-cookie-health.ts    # 健康检查工具
```

## 🔐 安全注意事项

### Cookie 安全

1. **设置文件权限**
   ```bash
   chmod 600 /home/ecs-user/cookies/*.json
   ```

2. **不要提交到 Git**
   ```bash
   # 确保 .gitignore 包含
   cookies/
   *.json
   ```

3. **定期更换账号**
   - 建议使用专门的测试账号
   - 不要使用个人主账号
   - 定期检查账号登录记录

### 账号安全

1. **使用独立账号**
   - 为服务器创建专门的平台账号
   - 不要使用个人账号

2. **监控异常登录**
   - 定期检查平台的登录记录
   - 发现异常立即更换密码

3. **限制访问频率**
   - 避免频繁请求触发风控
   - 添加请求间隔（已在代码中实现）

## 🔧 故障排查

### 问题 1：登录失败

**症状**：运行 `login-platform.ts` 后提示"登录失败"

**解决方案**：
1. 确保在浏览器中完成了登录
2. 确认能看到个人主页
3. 等待页面完全加载后再按回车
4. 检查网络连接

### 问题 2：Cookie 刷新失败

**症状**：运行 `refresh-cookies.ts` 后提示"Cookie 已失效"

**解决方案**：
1. Cookie 可能已完全过期
2. 需要重新登录：`npx tsx scripts/login-platform.ts <platform>`

### 问题 3：浏览器启动失败

**症状**：提示找不到 Chrome

**解决方案**：
1. 检查 Chrome 是否安装：`which google-chrome`
2. 设置环境变量：`export CHROME_PATH=/usr/bin/google-chrome`
3. 或在 `.env.local` 中设置：`CHROME_PATH=/usr/bin/google-chrome`

### 问题 4：Cookie 文件不存在

**症状**：健康检查显示"文件不存在"

**解决方案**：
1. 确认 Cookie 目录：`ls -la /home/ecs-user/cookies/`
2. 如果目录不存在，创建它：`mkdir -p /home/ecs-user/cookies`
3. 运行登录脚本

## 📊 监控和日志

### 查看刷新日志
```bash
tail -f /tmp/cookie-refresh.log
```

### 查看健康检查日志
```bash
tail -f /tmp/cookie-health.log
```

### 设置告警（可选）

当 Cookie 失效时发送邮件：
```bash
# 在 crontab 中添加
0 9 * * * cd /home/ecs-user/tplink-app/tplink/soul_profile_app && npx tsx scripts/check-cookie-health.ts || echo "Cookie 健康检查失败" | mail -s "Cookie 告警" your@email.com
```

## 🎯 工作原理

### Cookie 生命周期

```
1. 初次登录
   ↓
   手动在浏览器登录
   ↓
   保存 Cookie 到文件
   ↓
2. 日常使用
   ↓
   服务器读取 Cookie
   ↓
   使用 Cookie 访问平台 API
   ↓
3. 定期刷新
   ↓
   自动刷新 Cookie（延长有效期）
   ↓
4. Cookie 失效
   ↓
   重新登录（回到步骤 1）
```

### 数据获取流程

```
用户提供 ID
   ↓
解析为平台 URL
   ↓
读取平台 Cookie
   ↓
使用 Cookie 访问平台
   ↓
抓取主页数据
   ↓
返回给用户
```

## 📝 最佳实践

1. **定期检查**
   - 每天自动刷新 Cookie
   - 每周检查健康状态
   - 每月重新登录一次

2. **备份 Cookie**
   - 工具会自动备份
   - 可以手动备份到其他位置

3. **监控日志**
   - 定期查看刷新日志
   - 关注失败记录

4. **及时更新**
   - Cookie 即将过期时立即刷新
   - Cookie 失效时立即重新登录

## 🆘 获取帮助

如果遇到问题：

1. 查看日志文件
2. 运行健康检查
3. 查看本文档的故障排查部分
4. 检查相关文档：
   - `COOKIE_UPDATE_GUIDE.md` - Cookie 更新指南
   - `SERVER_LOGIN_SOLUTION.md` - 登录方案说明

## ✅ 总结

现在你可以：
- ✅ 在服务器上登录小红书/抖音账号
- ✅ 自动保存和刷新 Cookie
- ✅ 用户提供 ID 即可获取主页数据
- ✅ 监控 Cookie 健康状态
- ✅ 自动化维护 Cookie

**下一步**：运行 `npx tsx scripts/login-platform.ts xhs` 开始登录！
