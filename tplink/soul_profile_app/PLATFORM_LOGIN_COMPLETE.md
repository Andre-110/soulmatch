# 平台登录工具 - 完成总结

## ✅ 已创建的工具

### 1. 核心脚本

| 文件 | 功能 | 用法 |
|------|------|------|
| `scripts/login-platform.ts` | 自动化登录并保存 Cookie | `npx tsx scripts/login-platform.ts xhs` |
| `scripts/refresh-cookies.ts` | 刷新 Cookie 延长有效期 | `npx tsx scripts/refresh-cookies.ts all` |
| `scripts/check-cookie-health.ts` | 检查 Cookie 健康状态 | `npx tsx scripts/check-cookie-health.ts` |
| `scripts/platform-login-menu.sh` | 交互式菜单（快捷入口） | `./scripts/platform-login-menu.sh` |

### 2. 文档

| 文件 | 内容 |
|------|------|
| `PLATFORM_LOGIN_GUIDE.md` | 完整使用指南 |
| `SERVER_LOGIN_SOLUTION.md` | 技术方案说明 |
| `COOKIE_UPDATE_GUIDE.md` | Cookie 更新指南（已存在） |

## 🚀 快速开始

### 方式 1：使用交互式菜单（推荐）

```bash
cd /home/ecs-user/tplink-app/tplink/soul_profile_app
./scripts/platform-login-menu.sh
```

选择操作：
1. 登录小红书
2. 登录抖音
3. 刷新所有 Cookie
4. 检查 Cookie 健康状态
5. 测试小红书抓取
6. 测试抖音抓取

### 方式 2：直接运行命令

```bash
# 登录小红书
npx tsx scripts/login-platform.ts xhs

# 登录抖音
npx tsx scripts/login-platform.ts douyin

# 检查健康状态
npx tsx scripts/check-cookie-health.ts

# 刷新所有 Cookie
npx tsx scripts/refresh-cookies.ts all
```

## 📋 完整工作流程

### 初次设置

```bash
# 1. 进入项目目录
cd /home/ecs-user/tplink-app/tplink/soul_profile_app

# 2. 登录小红书
npx tsx scripts/login-platform.ts xhs
# 在浏览器中完成登录，按回车保存

# 3. 登录抖音
npx tsx scripts/login-platform.ts douyin
# 在浏览器中完成登录，按回车保存

# 4. 检查状态
npx tsx scripts/check-cookie-health.ts

# 5. 测试应用
npm run dev
# 访问 http://localhost:3000?debug=1
```

### 日常维护

```bash
# 设置自动刷新（每天凌晨 3 点）
crontab -e

# 添加以下行
0 3 * * * cd /home/ecs-user/tplink-app/tplink/soul_profile_app && npx tsx scripts/refresh-cookies.ts all >> /tmp/cookie-refresh.log 2>&1
```

## 🎯 功能特性

### ✅ 登录工具特性
- 自动打开浏览器
- 等待手动登录（扫码/验证码）
- 自动保存 Cookie
- 自动备份旧 Cookie
- 验证登录状态
- 显示关键 Cookie

### ✅ 刷新工具特性
- 支持单个平台或所有平台
- 无头浏览器运行
- 自动验证 Cookie 有效性
- 自动备份旧 Cookie
- 失败时提供修复建议

### ✅ 健康检查特性
- 检查文件是否存在
- 验证 Cookie 数量
- 检查关键 Cookie
- 检测过期状态
- 提供修复建议
- 生成健康报告

## 📊 Cookie 生命周期

```
初次登录 (login-platform.ts)
    ↓
保存 Cookie 到文件
    ↓
应用使用 Cookie 访问平台
    ↓
定期刷新 (refresh-cookies.ts)
    ↓
Cookie 延长有效期
    ↓
健康检查 (check-cookie-health.ts)
    ↓
发现问题 → 重新登录
```

## 🔐 安全措施

1. **文件权限**
   ```bash
   chmod 600 /home/ecs-user/cookies/*.json
   ```

2. **不提交到 Git**
   - Cookie 目录已在 `.gitignore`

3. **使用独立账号**
   - 建议使用测试账号
   - 不要使用个人主账号

4. **定期更换**
   - 每月检查账号登录记录
   - 发现异常立即更换密码

## 🛠️ 故障排查

### 问题：浏览器无法启动

**解决方案**：
```bash
# 检查 Chrome
which google-chrome

# 如果没有，安装
sudo apt install google-chrome-stable

# 或设置环境变量
export CHROME_PATH=/usr/bin/google-chrome
```

### 问题：Cookie 刷新失败

**解决方案**：
```bash
# Cookie 可能已过期，重新登录
npx tsx scripts/login-platform.ts xhs
```

### 问题：抓取数据失败

**解决方案**：
```bash
# 1. 检查 Cookie 状态
npx tsx scripts/check-cookie-health.ts

# 2. 如果失效，重新登录
npx tsx scripts/login-platform.ts xhs

# 3. 测试抓取
./scripts/platform-login-menu.sh
# 选择 5 或 6 测试抓取
```

## 📈 监控和日志

### 查看日志
```bash
# 刷新日志
tail -f /tmp/cookie-refresh.log

# 健康检查日志
tail -f /tmp/cookie-health.log
```

### 设置告警
```bash
# 在 crontab 中添加
0 9 * * * cd /home/ecs-user/tplink-app/tplink/soul_profile_app && npx tsx scripts/check-cookie-health.ts || echo "Cookie 健康检查失败" | mail -s "Cookie 告警" your@email.com
```

## 🎉 完成！

现在你可以：

1. ✅ **在服务器上登录平台账号**
   - 小红书
   - 抖音
   - 其他平台（微博、网易云、豆瓣、知乎）

2. ✅ **自动化 Cookie 管理**
   - 自动保存
   - 自动刷新
   - 自动备份

3. ✅ **用户提供 ID 即可获取数据**
   - 系统自动使用 Cookie
   - 无需用户登录
   - 支持所有绑定平台

4. ✅ **健康监控**
   - 实时检查 Cookie 状态
   - 自动告警
   - 提供修复建议

## 📚 相关文档

- `PLATFORM_LOGIN_GUIDE.md` - 完整使用指南
- `SERVER_LOGIN_SOLUTION.md` - 技术方案
- `COOKIE_UPDATE_GUIDE.md` - Cookie 更新指南

## 🚀 下一步

**立即开始**：
```bash
cd /home/ecs-user/tplink-app/tplink/soul_profile_app
./scripts/platform-login-menu.sh
```

选择 "1. 登录小红书" 开始！
