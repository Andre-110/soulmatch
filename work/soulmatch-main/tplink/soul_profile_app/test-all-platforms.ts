import { scrapeWeibo, scrapeDouyin, scrapeNetease, scrapeDouban, scrapeZhihu } from './lib/profileScrape';
import { screenshotMultiplePlatforms } from './lib/screenshotPlatformBatch';
import fs from 'fs';
import path from 'path';

async function testAllPlatforms() {
  console.log('='.repeat(80));
  console.log('测试所有平台爬取和截图');
  console.log('='.repeat(80));

  const platforms = [
    {
      name: '微博',
      platform: 'weibo' as const,
      testId: '1195230310',  // 示例微博用户 ID
      testUrl: 'https://weibo.com/u/1195230310',
      scraper: scrapeWeibo,
    },
    {
      name: '抖音',
      platform: 'douyin' as const,
      testId: 'MS4wLjABAAAA5ZrIrbgva_HMeHuNn64GoSDt82zzANP2_8RhYK_-qdc',  // 示例抖音 sec_uid
      testUrl: 'https://www.douyin.com/user/MS4wLjABAAAA5ZrIrbgva_HMeHuNn64GoSDt82zzANP2_8RhYK_-qdc',
      scraper: scrapeDouyin,
    },
    {
      name: '网易云音乐',
      platform: 'netease' as const,
      testId: '32953014',  // 示例网易云用户 ID
      testUrl: 'https://music.163.com/#/user/home?id=32953014',
      scraper: scrapeNetease,
    },
    {
      name: '豆瓣',
      platform: 'douban' as const,
      testId: 'people',  // 示例豆瓣用户 ID
      testUrl: 'https://www.douban.com/people/people/',
      scraper: scrapeDouban,
    },
    {
      name: '知乎',
      platform: 'zhihu' as const,
      testId: 'excited-vczh',  // 示例知乎用户 ID
      testUrl: 'https://www.zhihu.com/people/excited-vczh',
      scraper: scrapeZhihu,
    },
  ];

  for (const p of platforms) {
    console.log('\n' + '='.repeat(80));
    console.log(`测试平台: ${p.name}`);
    console.log('='.repeat(80));
    console.log('URL:', p.testUrl);

    try {
      // 测试 API 抓取
      console.log('\n1. API 抓取...');
      const scrapeResult = await p.scraper(p.testId, p.testUrl);
      console.log('- 状态:', scrapeResult.ok ? '✅ 成功' : '❌ 失败');
      console.log('- 方法:', scrapeResult.method);
      console.log('- 摘录长度:', scrapeResult.excerpt.length, '字符');
      if (scrapeResult.excerpt.length > 0) {
        console.log('- 摘录预览:', scrapeResult.excerpt.slice(0, 150) + '...');
      }

      // 测试截图
      console.log('\n2. 截图功能...');
      const screenshots = await screenshotMultiplePlatforms([{
        platform: p.platform,
        extractedId: p.testId,
      }]);
      const screenshot = screenshots.get(p.platform);

      if (screenshot?.ok && screenshot.dataUrl) {
        console.log('- 截图状态: ✅ 成功');
        console.log('- 图片大小:', Math.round(screenshot.dataUrl.length / 1024), 'KB');

        // 保存截图
        const base64Data = screenshot.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const outputPath = path.join(process.cwd(), `test-${p.platform}-screenshot.jpg`);
        fs.writeFileSync(outputPath, buffer);
        console.log('- 截图已保存:', outputPath);
      } else {
        console.log('- 截图状态: ❌ 失败');
        console.log('- 错误:', screenshot?.error);
      }
    } catch (error) {
      console.error(`\n❌ ${p.name} 测试失败:`, error);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('所有平台测试完成');
  console.log('='.repeat(80));
}

testAllPlatforms()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试出错:', error);
    process.exit(1);
  });
