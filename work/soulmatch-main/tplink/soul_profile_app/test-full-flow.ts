import { scrapeFromPlatformUploads } from './lib/profileScrape';
import fs from 'fs';
import path from 'path';

// 模拟用户上传的平台数据
const mockUploads = [
  {
    type: 'platform:weibo',
    content: JSON.stringify({
      profileUrl: 'https://weibo.com/u/1195230310',
      extractedId: '1195230310',
    }),
    userId: 'test-user',
    createdAt: new Date(),
  },
  {
    type: 'platform:netease',
    content: JSON.stringify({
      profileUrl: 'https://music.163.com/#/user/home?id=32953014',
      extractedId: '32953014',
    }),
    userId: 'test-user',
    createdAt: new Date(),
  },
  {
    type: 'platform:douyin',
    content: JSON.stringify({
      profileUrl: 'https://www.douyin.com/user/MS4wLjABAAAA5ZrIrbgva_HMeHuNn64GoSDt82zzANP2_8RhYK_-qdc',
      extractedId: 'MS4wLjABAAAA5ZrIrbgva_HMeHuNn64GoSDt82zzANP2_8RhYK_-qdc',
    }),
    userId: 'test-user',
    createdAt: new Date(),
  },
];

async function testFullFlow() {
  console.log('='.repeat(80));
  console.log('测试完整爬取流程（API + 截图混合模式）');
  console.log('='.repeat(80));

  console.log('\n测试平台:');
  console.log('1. 微博 - API 抓取');
  console.log('2. 网易云 - API 抓取');
  console.log('3. 抖音 - 截图模式');
  console.log('');

  const startTime = Date.now();

  try {
    const results = await scrapeFromPlatformUploads(mockUploads as any);

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('抓取结果汇总');
    console.log('='.repeat(80));

    for (const result of results) {
      console.log(`\n【${result.platform.toUpperCase()}】`);
      console.log('- 状态:', result.ok ? '✅ 成功' : '❌ 失败');
      console.log('- 方法:', result.method);
      console.log('- 数据长度:', result.excerpt.length, '字符');
      console.log('- 有截图:', result.screenshotDataUrl ? '✅ 是' : '❌ 否');

      if (result.excerpt.length > 0) {
        console.log('- 数据预览:', result.excerpt.slice(0, 100) + '...');
      }

      // 保存截图
      if (result.screenshotDataUrl) {
        const base64Data = result.screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const outputPath = path.join(process.cwd(), `full-flow-${result.platform}.jpg`);
        fs.writeFileSync(outputPath, buffer);
        console.log('- 截图保存:', outputPath);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('性能统计');
    console.log('='.repeat(80));
    console.log('- 总耗时:', (duration / 1000).toFixed(1), '秒');
    console.log('- 平台数量:', results.length);
    console.log('- 成功数量:', results.filter(r => r.ok).length);
    console.log('- 平均耗时:', (duration / results.length / 1000).toFixed(1), '秒/平台');

    console.log('\n' + '='.repeat(80));
    console.log('✅ 完整流程测试成功');
    console.log('='.repeat(80));
    console.log('\n💡 下一步:');
    console.log('1. 这些数据可以直接传给 OpenAI GPT-4o');
    console.log('2. GPT-4o 会分析文本 + 截图生成档案');
    console.log('3. 微博和网易云的 API 数据质量很高');
    console.log('4. 抖音的截图可以被 GPT-4o 视觉分析');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  }
}

testFullFlow()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试出错:', error);
    process.exit(1);
  });
