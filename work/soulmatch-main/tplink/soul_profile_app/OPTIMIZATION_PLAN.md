# CPU 占用优化方案

## 问题根源
- 并发启动多个 Playwright Chrome 实例
- 每个实例全屏渲染（1920x1080）+ 8秒等待
- 失败后立即重试，加剧资源消耗

## 优化方案

### 1. 限制并发数（立即见效）
```typescript
// profileScrape.ts 中添加并发控制
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number = 2
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    results.push(...await Promise.all(batch.map(t => t())));
  }
  return results;
}
```

### 2. 复用浏览器实例
```typescript
// 创建全局浏览器池，避免每次都启动新实例
let browserInstance: Browser | null = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({...});
  }
  return browserInstance;
}
```

### 3. 降低截图分辨率
```typescript
// screenshotPlatform.ts:104
viewport: { width: 1280, height: 720 },  // 从 1920x1080 降低
```

### 4. 减少等待时间
```typescript
// screenshotPlatform.ts:116
await page.waitForTimeout(3000);  // 从 8000ms 降到 3000ms
```

### 5. 优化截图策略
- 只对关键平台截图（如小红书、抖音）
- 其他平台优先使用 API 抓取
- 截图失败不重试，直接降级到文本

### 6. 添加资源限制
```typescript
// next.config.mjs
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
  maxDuration: 60,  // 从 120 降到 60
};
```

## 优先级
1. **高优先级**：限制并发数（2个）
2. **中优先级**：降低分辨率、减少等待时间
3. **低优先级**：浏览器池复用（需要处理生命周期）
