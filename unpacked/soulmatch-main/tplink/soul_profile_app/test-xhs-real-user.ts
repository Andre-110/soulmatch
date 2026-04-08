import { screenshotMultiplePlatforms } from './lib/screenshotPlatformBatch';
import fs from 'fs';
import path from 'path';

async function testRealUser() {
  console.log('='.repeat(80));
  console.log('测试真实小红书用户截图');
  console.log('='.repeat(80));

  // 使用一个真实存在的小红书用户 ID
  // 你可以从小红书网页版复制一个用户的 ID
  const testUsers = [
    '5c7614b60000000007024f75',  // 测试用户 1
    '5ff0e6410000000001001274',  // 测试用户 2（示例）
  ];

  for (const userId of testUsers) {
    console.log(`\n测试用户: ${userId}`);
    console.log('URL:', `https://www.xiaohongshu.com/user/profile/${userId}`);

    const tasks = [{
      platform: 'xhs' as const,
      extractedId: userId,
    }];

    const screenshots = await screenshotMultiplePlatforms(tasks);
    const screenshot = screenshots.get('xhs');

    if (screenshot?.ok && screenshot.dataUrl) {
      console.log('✅ 截图成功');
      console.log('图片大小:', Math.round(screenshot.dataUrl.length / 1024), 'KB');

      // 保存截图
      const base64Data = screenshot.dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const outputPath = path.join(process.cwd(), `test-xhs-user-${userId}.jpg`);
      fs.writeFileSync(outputPath, buffer);
      console.log('截图已保存:', outputPath);
    } else {
      console.log('❌ 截图失败');
      console.log('错误:', screenshot?.error);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('请查看截图文件，确认是否显示用户主页（而不是登录页）');
  console.log('='.repeat(80));
}

testRealUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试出错:', error);
    process.exit(1);
  });
