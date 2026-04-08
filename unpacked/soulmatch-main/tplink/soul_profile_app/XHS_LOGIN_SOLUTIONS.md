# 小红书 Cookie 管理方案

## 问题
Linux 服务器无法直接登录小红书（需要扫码/验证码）

## 推荐方案：本地登录 + 定期同步

### 工作流程

```
Mac 浏览器登录
    ↓
导出 Cookie (EditThisCookie)
    ↓
运行同步脚本
    ↓
Cookie 自动上传到服务器
    ↓
服务器验证 Cookie 有效性
```

### 使用方法

#### 1. 在 Mac 上设置（一次性）

```bash
# 下载同步脚本到 Mac
scp ecs-user@your-server:/home/ecs-user/tplink-app/tplink/soul_profile_app/sync-cookie-from-mac.sh ~/

# 编辑脚本，填入服务器 IP
nano ~/sync-cookie-from-mac.sh
# 修改这一行：
# SERVER_HOST="your-server-ip"  # 改为实际 IP

# 添加执行权限
chmod +x ~/sync-cookie-from-mac.sh
```

#### 2. 每次更新 Cookie

```bash
# 1. 浏览器登录小红书
# 2. 使用 EditThisCookie 导出到 /Users/liuqi/Downloads/cookies (14).json
# 3. 运行同步脚本
~/sync-cookie-from-mac.sh
```

#### 3. 设置自动同步（可选）

```bash
# 在 Mac 上设置 cron，每周自动同步
crontab -e

# 添加这一行（每周一早上 9 点）
0 9 * * 1 ~/sync-cookie-from-mac.sh
```

---

## 方案 2：VNC 远程桌面

如果需要在服务器上直接登录，可以安装桌面环境。

### 安装步骤

```bash
# 1. 安装桌面环境
sudo apt update
sudo apt install -y xfce4 xfce4-goodies

# 2. 安装 VNC 服务器
sudo apt install -y tightvncserver

# 3. 启动 VNC
vncserver :1 -geometry 1280x720 -depth 24

# 4. 设置密码（首次运行时）
# 输入 VNC 密码

# 5. 在 Mac 上连接
# 使用 VNC Viewer 连接到: your-server-ip:5901
```

### 在 VNC 中登录小红书

```bash
# 1. 在 VNC 桌面中打开终端
# 2. 启动 Chrome
google-chrome --no-sandbox

# 3. 访问 https://www.xiaohongshu.com
# 4. 手动登录
# 5. 使用 EditThisCookie 导出
# 6. 保存到 /home/ecs-user/cookies/cookies (6).json
```

---

## 方案 3：X11 转发（不推荐）

```bash
# 在 Mac 上安装 XQuartz
brew install --cask xquartz

# SSH 连接时启用 X11 转发
ssh -X ecs-user@your-server

# 在服务器上启动 Chrome（会显示在 Mac 上）
google-chrome --no-sandbox https://www.xiaohongshu.com
```

**缺点**：
- 网络延迟高
- 需要安装 XQuartz
- 配置复杂

---

## 方案 4：放弃 Cookie，只用截图

修改代码，跳过 API 抓取，只依赖截图 + GPT-4o 视觉分析。

### 修改代码

```typescript
// lib/profileScrape.ts
export async function scrapeXhs(keyword: string, profileUrl: string): Promise<ScrapeOutcome> {
  // 直接返回需要截图
  return {
    platform: 'xhs',
    url: profileUrl,
    ok: false,
    excerpt: '',
    method: 'screenshot-only',  // 标记为仅截图模式
  };
}
```

**优点**：
- 不需要维护 Cookie
- 不受 API 限制
- GPT-4o 可以分析截图

**缺点**：
- 无法获取结构化数据
- 依赖视觉分析

---

## 推荐实施方案

### 短期（立即可用）

**使用方案 1：本地同步**

1. 在 Mac 上登录小红书
2. 导出 Cookie
3. 运行同步脚本上传到服务器
4. 每周重复一次

**时间成本**：5 分钟/周

### 长期（如果需要频繁更新）

**使用方案 2：VNC 桌面**

1. 安装 VNC 服务器（一次性，30 分钟）
2. 需要时通过 VNC 连接
3. 在服务器上直接登录

**时间成本**：30 分钟设置，之后随时可用

---

## 我的建议

**推荐方案 1（本地同步）**，因为：

✅ 最简单
✅ 最稳定
✅ 不需要修改服务器
✅ Cookie 在本地浏览器中最新鲜
✅ 5 分钟就能完成

**你想用哪个方案？我可以帮你：**
1. 配置同步脚本（方案 1）
2. 安装 VNC 服务器（方案 2）
3. 修改代码跳过 API（方案 4）
