# Local 分支说明文档

## 分支概述

`local` 分支是基于主分支的开发分支，包含了用户体验优化和移动端适配改进。

## 主要改动

### 1. 首页默认显示优化
**文件**: `app/page.tsx`

- **改动**: 将初始 step 从 `-1` 改为 `0`
- **效果**: 所有用户（无论是否登录）默认看到"把公开痕迹整理成你的数字分身"的欢迎页面，而不是登录页
- **原因**: 提升首次访问体验，让用户先了解产品功能再决定是否注册

### 2. Debug 模式增强
**文件**: `app/page.tsx`

- **改动**: 在问卷步骤(step 4)，debug 模式下自动跳过所有问题
- **效果**: 使用 `?debug=1` 参数时，可以快速测试完整流程
- **用途**: 开发和演示时节省时间

### 3. 分析任务冲突处理
**文件**: `app/page.tsx`

- **改动**: 优化 409 错误处理逻辑
- **效果**: 当检测到已有分析任务在进行时，不再回退到上一步，而是保持在分析页面等待完成
- **原因**: 避免用户重复提交，提供更好的等待体验

### 4. 移动端报告页适配
**文件**: `app/globals.css`

针对小屏幕设备（max-width: 420px）的优化：

- **字体大小**: 报告摘要从 17px 降到 15px
- **行高**: 从 1.8 降到 1.7，减少垂直空间占用
- **宽度限制**: 移除 720px 的最大宽度限制，改为 100%
- **内边距**: 增加 4px 左右内边距，防止文字贴边被截断
- **区块间距**: section 左右内边距从 18px 降到 16px
- **标题大小**: 主标题从 32px 降到 26px

**效果**: 报告页面在手机上显示更完整，文字不会被截断

### 5. API 错误处理增强
**文件**: `app/api/analyze/route.ts`

- 添加 `summarizeOpenAIBaseUrl()`: 规范化 OpenAI API 基础 URL
- 添加 `serializeUnknownError()`: 更好地序列化错误信息，包括 cause 链
- 添加 traceId、openaiModel、openaiBaseUrl 变量用于追踪和日志

## 环境要求

- Node.js 18+
- npm 或 yarn
- 端口 3010 可用

## 启动步骤

### 1. 安装依赖（首次运行）

```bash
cd /home/ecs-user/tplink-app/work/soulmatch-main/tplink/soul_profile_app
npm install
```

### 2. 配置环境变量

确保 `.env.local` 文件存在并包含以下配置：

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://yunwu.ai/v1
OPENAI_MODEL=gpt-4o
```

### 3. 构建项目

```bash
npm run build
```

### 4. 启动服务器

**方式一：使用启动脚本（推荐）**
```bash
PORT=3010 bash scripts/start.sh
```

**方式二：直接使用 next start**
```bash
PORT=3010 npm start
```

**方式三：后台运行**
```bash
PORT=3010 bash scripts/start.sh &
```

### 5. 访问应用

- 本地访问: http://localhost:3010
- 网络访问: http://0.0.0.0:3010
- 域名访问: http://soulmatch.tplink.com (需配置 nginx)

## 停止服务器

```bash
# 查找进程
ps aux | grep next-server

# 停止进程
pkill -9 next-server
```

## Debug 模式

在 URL 后添加 `?debug=1` 参数可以启用 debug 模式：

```
http://localhost:3010?debug=1
```

Debug 模式特性：
- 自动填充平台数据
- 跳过问卷问题
- 显示 DEBUG 标识

## 常见问题

### Q: 端口 3010 被占用
```bash
# 查看占用端口的进程
lsof -i :3010

# 停止占用进程
kill -9 <PID>
```

### Q: 构建失败
```bash
# 清理缓存重新构建
rm -rf .next
npm run build
```

### Q: 页面显示旧内容
```bash
# 停止服务器
pkill -9 next-server

# 重新构建
npm run build

# 重新启动
PORT=3010 bash scripts/start.sh
```

### Q: 移动端样式不生效
确保已经重新构建项目，CSS 更改需要重新构建才能生效。

## Nginx 配置

如果需要通过域名访问，参考以下 nginx 配置：

```nginx
server {
    listen 80;
    server_name soulmatch.tplink.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## 开发建议

1. **修改代码后**: 必须重新构建 (`npm run build`) 才能看到效果
2. **修改样式**: CSS 更改也需要重新构建
3. **测试移动端**: 使用浏览器开发者工具的设备模拟器，或在真实设备上测试
4. **Debug 模式**: 开发时使用 `?debug=1` 可以快速测试流程

## 版本信息

- Next.js: 16.2.1
- React: 19.x
- Node.js: 18+
- 构建日期: 2026-04-08
