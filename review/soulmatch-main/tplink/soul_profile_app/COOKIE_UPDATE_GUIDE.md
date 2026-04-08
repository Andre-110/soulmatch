# 小红书 Cookie 更新指南

## 问题
当前 Cookie 已过期，需要重新获取。

## 解决步骤

### 1. 安装浏览器插件

推荐使用以下任一插件：
- **EditThisCookie**（Chrome/Edge）
- **Cookie-Editor**（Firefox/Chrome）

### 2. 登录小红书

1. 打开浏览器，访问 https://www.xiaohongshu.com
2. 点击右上角"登录"
3. 使用手机号/微信/QQ 登录
4. 确保登录成功，能看到个人主页

### 3. 导出 Cookie

#### 使用 EditThisCookie：
1. 点击浏览器工具栏的 EditThisCookie 图标
2. 点击右下角的"导出"按钮（📤）
3. Cookie 会复制到剪贴板

#### 使用 Cookie-Editor：
1. 点击浏览器工具栏的 Cookie-Editor 图标
2. 点击"Export"
3. 选择"JSON"格式
4. 复制内容

### 4. 保存 Cookie 文件

将导出的 Cookie 保存到：
```
/home/ecs-user/cookies/cookies (6).json
```

或者项目根目录的：
```
../cookies/cookies (6).json
```

### 5. 验证 Cookie 格式

Cookie 文件应该是 JSON 数组格式：
```json
[
  {
    "name": "web_session",
    "value": "xxx",
    "domain": ".xiaohongshu.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "None",
    "expirationDate": 1234567890
  },
  ...
]
```

### 6. 重新测试

```bash
cd /home/ecs-user/tplink-app/tplink/soul_profile_app
npx tsx test-xhs-scrape.ts
```

## Cookie 有效期

- 小红书 Cookie 通常有效期：**1-3 个月**
- 建议每月检查一次
- 如果频繁失效，可能是账号安全策略

## 自动化更新（可选）

可以创建定期提醒：
```bash
# 每月 1 号提醒更新 Cookie
echo "0 9 1 * * echo '提醒：检查小红书 Cookie 是否过期' | mail -s 'Cookie 检查' your@email.com" | crontab -
```

## 其他平台 Cookie

同样的方法适用于其他平台：
- 微博：`cookies (7).json`
- 抖音：`cookies (8).json`
- 网易云：`cookies (9).json`
- 豆瓣：`cookies (10).json`
- 知乎：`cookies (11).json`

## 注意事项

1. ⚠️ **不要分享 Cookie**：Cookie 包含登录凭证
2. ⚠️ **定期更新**：过期后需要重新导出
3. ⚠️ **备份 Cookie**：避免丢失
4. ⚠️ **安全存储**：不要提交到 Git
