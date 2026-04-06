import { scrapeXhs } from './lib/profileScrape';
import { screenshotMultiplePlatforms } from './lib/screenshotPlatformBatch';
import fs from 'fs';
import path from 'path';

async function testXhsScrape() {
  console.log('='.repeat(80));
  console.log('测试小红书爬取和截图');
  console.log('='.repeat(80));

  // 测试用户 ID（示例）
  const testUserId = '5c7614b60000000007024f75'; // 替换为实际的小红书用户 ID
  const testUrl = `https://www.xiaohongshu.com/user/profile/${testUserId}`;

  console.log('\n1. 测试 API 抓取...');
  console.log('用户 ID:', testUserId);
  console.log('URL:', testUrl);

  try {
    const scrapeResult = await scrapeXhs(testUserId, testUrl);
    console.log('\n抓取结果:');
    console.log('- 状态:', scrapeResult.ok ? '✅ 成功' : '❌ 失败');
    console.log('- 方法:', scrapeResult.method);
    console.log('- 摘录长度:', scrapeResult.excerpt.length, '字符');
    console.log('- 摘录内容:', scrapeResult.excerpt.slice(0, 200));

    // 如果 API 抓取失败，测试截图
    if (!scrapeResult.ok || scrapeResult.method === 'pending-screenshot') {
      console.log('\n2. 测试截图功能...');

      const screenshotTasks = [{
        platform: 'xhs' as const,
        extractedId: testUserId,
      }];

      const screenshots = await screenshotMultiplePlatforms(screenshotTasks);
      const screenshot = screenshots.get('xhs');

      if (screenshot?.ok && screenshot.dataUrl) {
        console.log('- 截图状态: ✅ 成功');
        console.log('- 图片大小:', Math.round(screenshot.dataUrl.length / 1024), 'KB');
        console.log('- 图片格式:', screenshot.dataUrl.slice(0, 30));

        // 保存截图到文件
        const base64Data = screenshot.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const outputPath = path.join(process.cwd(), 'test-xhs-screenshot.jpg');
        fs.writeFileSync(outputPath, buffer);
        console.log('- 截图已保存:', outputPath);
      } else {
        console.log('- 截图状态: ❌ 失败');
        console.log('- 错误:', screenshot?.error);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('测试完成');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n测试失败:', error);
    throw error;
  }
}

testXhsScrape()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试出错:', error);
    process.exit(1);
  });
