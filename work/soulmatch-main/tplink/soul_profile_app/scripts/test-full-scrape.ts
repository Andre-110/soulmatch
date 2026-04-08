import { scrapeFromPlatformUploads } from '../lib/profileScrape';
import prisma from '../lib/prisma';

async function testFullScrape() {
  console.log('='.repeat(80));
  console.log('🧪 测试完整抓取流程（包含截图）');
  console.log('='.repeat(80));

  const user = await prisma.user.findUnique({
    where: { email: 'debug@soulmatch.local' },
  });

  if (!user) {
    console.log('❌ 未找到 debug 用户');
    return;
  }

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n📋 用户: ${user.email}`);
  console.log(`📋 上传数据: ${uploads.length} 条\n`);

  const startTime = Date.now();
  console.log('⏳ 开始抓取...\n');

  const results = await scrapeFromPlatformUploads(uploads);

  const duration = Date.now() - startTime;

  console.log('\n' + '='.repeat(80));
  console.log('📊 抓取结果');
  console.log('='.repeat(80));

  results.forEach((r, i) => {
    console.log(`\n[${i + 1}] ${r.platform.toUpperCase()}`);
    console.log(`    URL: ${r.url}`);
    console.log(`    状态: ${r.ok ? '✅ 成功' : '❌ 失败'}`);
    console.log(`    方法: ${r.method}`);
    console.log(`    文本长度: ${r.excerpt.length} 字符`);
    console.log(`    截图: ${r.screenshotDataUrl ? '✅ 有' : '❌ 无'}`);
    if (r.screenshotDataUrl) {
      const size = Math.round(r.screenshotDataUrl.length / 1024);
      console.log(`    截图大小: ${size} KB`);
    }
    if (r.excerpt.length > 0 && r.excerpt.length < 200) {
      console.log(`    文本预览: ${r.excerpt}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('📈 统计');
  console.log('='.repeat(80));

  const successCount = results.filter(r => r.ok).length;
  const withScreenshot = results.filter(r => r.screenshotDataUrl).length;
  const withText = results.filter(r => r.excerpt.length > 0).length;

  console.log(`总平台数: ${results.length}`);
  console.log(`成功数: ${successCount} (${Math.round(successCount / results.length * 100)}%)`);
  console.log(`有截图: ${withScreenshot}`);
  console.log(`有文本: ${withText}`);
  console.log(`总耗时: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);

  await prisma.$disconnect();
}

testFullScrape().catch(console.error);
