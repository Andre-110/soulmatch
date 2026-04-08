# 资源监控系统

## 功能说明

自动监控服务器资源使用情况，防止服务器崩溃。

### 监控指标

1. **CPU 使用率**
2. **内存使用率**

### 阈值配置

| 阈值 | 默认值 | 环境变量 | 说明 |
|------|--------|---------|------|
| CPU 警告 | 80% | `CPU_WARNING_THRESHOLD` | 超过后记录警告日志 |
| CPU 危险 | 95% | `CPU_CRITICAL_THRESHOLD` | 超过后拒绝新请求 |
| 内存警告 | 75% | `MEMORY_WARNING_THRESHOLD` | 超过后记录警告日志 |
| 内存危险 | 90% | `MEMORY_KILL_THRESHOLD` | 超过后强制停止服务 |

### 保护机制

#### 1. 警告级别（Warning）
- **触发条件**：CPU > 80% 或 内存 > 75%
- **行为**：记录警告日志，允许请求继续
- **日志示例**：
  ```
  [ResourceMonitor] ⚠️  CPU 使用率 85.3% 超过警告阈值 80%
  ```

#### 2. 危险级别（Critical）
- **触发条件**：CPU > 95%
- **行为**：拒绝新的 API 请求，返回 503 错误
- **响应示例**：
  ```json
  {
    "error": "服务器负载过高，请稍后重试",
    "details": "CPU 使用率 96.2% 超过危险阈值 95%",
    "retryAfter": 30
  }
  ```

#### 3. 强制停止（Kill）
- **触发条件**：内存 > 90%
- **行为**：
  1. 关闭所有浏览器实例
  2. 记录详细日志
  3. 1 秒后退出进程（exit code 1）
- **日志示例**：
  ```
  ================================================================================
  [ResourceMonitor] 🚨 紧急停止服务
  [ResourceMonitor] 原因: 内存使用率 92.1% 超过危险阈值 90%，服务即将停止
  [ResourceMonitor] CPU: 75.3%
  [ResourceMonitor] 内存: 92.1% (3220MB / 3499MB)
  ================================================================================
  [BrowserPool] 强制关闭浏览器实例...
  ```

### 监控端点

#### 1. 健康检查
```bash
GET /api/health
```

响应示例：
```json
{
  "status": "healthy",
  "message": "OK",
  "metrics": {
    "cpu": "45.2%",
    "memory": "62.3%",
    "memoryUsed": "2180MB",
    "memoryTotal": "3499MB"
  },
  "timestamp": "2026-04-04T20:30:00.000Z"
}
```

#### 2. 资源指标
```bash
GET /api/metrics
```

响应示例：
```json
{
  "cpu": {
    "usage": 45.2,
    "unit": "percent"
  },
  "memory": {
    "usage": 62.3,
    "used": 2180,
    "total": 3499,
    "unit": "MB"
  },
  "timestamp": 1712260200000,
  "uptime": 3600
}
```

### 配置方法

#### 1. 环境变量配置

创建或编辑 `.env.local`：
```bash
# CPU 阈值
CPU_WARNING_THRESHOLD=80
CPU_CRITICAL_THRESHOLD=95

# 内存阈值
MEMORY_WARNING_THRESHOLD=75
MEMORY_KILL_THRESHOLD=90
```

#### 2. 调整建议

**2 核 + 3.5GB 服务器（当前配置）**：
```bash
CPU_WARNING_THRESHOLD=70      # 更早警告
CPU_CRITICAL_THRESHOLD=90     # 更早拒绝
MEMORY_WARNING_THRESHOLD=70   # 更早警告
MEMORY_KILL_THRESHOLD=85      # 更早停止
```

**4 核 + 8GB 服务器**：
```bash
CPU_WARNING_THRESHOLD=80
CPU_CRITICAL_THRESHOLD=95
MEMORY_WARNING_THRESHOLD=80
MEMORY_KILL_THRESHOLD=90
```

### 监控频率

- **检查间隔**：每 10 秒
- **中间件检查**：每个 API 请求前

### 与进程管理器配合

#### PM2 配置

```json
{
  "apps": [{
    "name": "soul-profile-app",
    "script": "npm",
    "args": "start",
    "instances": 1,
    "autorestart": true,
    "watch": false,
    "max_memory_restart": "3G",
    "env": {
      "NODE_ENV": "production",
      "CPU_WARNING_THRESHOLD": "70",
      "CPU_CRITICAL_THRESHOLD": "90",
      "MEMORY_WARNING_THRESHOLD": "70",
      "MEMORY_KILL_THRESHOLD": "85"
    }
  }]
}
```

启动：
```bash
pm2 start ecosystem.config.json
pm2 logs soul-profile-app
```

#### Systemd 配置

```ini
[Unit]
Description=Soul Profile App
After=network.target

[Service]
Type=simple
User=ecs-user
WorkingDirectory=/home/ecs-user/tplink-app/tplink/soul_profile_app
Environment="NODE_ENV=production"
Environment="CPU_WARNING_THRESHOLD=70"
Environment="CPU_CRITICAL_THRESHOLD=90"
Environment="MEMORY_WARNING_THRESHOLD=70"
Environment="MEMORY_KILL_THRESHOLD=85"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动：
```bash
sudo systemctl daemon-reload
sudo systemctl enable soul-profile-app
sudo systemctl start soul-profile-app
sudo journalctl -u soul-profile-app -f
```

### 测试监控

#### 1. 压力测试
```bash
# 安装 Apache Bench
sudo apt-get install apache2-utils

# 发送 100 个并发请求
ab -n 1000 -c 100 http://localhost:3000/api/health
```

#### 2. 监控日志
```bash
# 实时查看日志
npm run dev

# 或使用 PM2
pm2 logs soul-profile-app --lines 100
```

#### 3. 查看指标
```bash
# 健康检查
curl http://localhost:3000/api/health

# 资源指标
curl http://localhost:3000/api/metrics

# 持续监控
watch -n 2 'curl -s http://localhost:3000/api/metrics | jq'
```

### 告警集成（可选）

可以将监控数据发送到外部服务：

```typescript
// lib/resourceMonitor.ts 中添加
async function sendAlert(message: string, metrics: ResourceMetrics) {
  // 发送到 Slack
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ text: message }),
  });

  // 或发送到钉钉
  await fetch(process.env.DINGTALK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      msgtype: 'text',
      text: { content: message },
    }),
  });
}
```

### 故障排查

#### 问题：监控不工作
```bash
# 检查监控是否启动
curl http://localhost:3000/api/health

# 查看日志
grep "ResourceMonitor" logs/*.log
```

#### 问题：频繁触发 kill
- 降低 `MEMORY_KILL_THRESHOLD`
- 检查是否有内存泄漏
- 增加服务器内存

#### 问题：CPU 监控不准确
- Linux 系统需要 `top` 命令
- 确保有执行权限

### 性能影响

- **CPU 开销**：< 1%
- **内存开销**：< 10MB
- **检查延迟**：< 100ms

### 注意事项

1. **不要设置过低的阈值**，否则会频繁拒绝请求
2. **监控日志会占用磁盘空间**，定期清理
3. **强制停止会中断正在处理的请求**，用户可能看到错误
4. **配合进程管理器使用**，自动重启服务
