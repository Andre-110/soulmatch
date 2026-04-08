import { scrapeFromPlatformUploads } from '../lib/profileScrape';
import { tryOpenAISoulReport, buildFallbackSoulReport, ensureBlocksCoverAllScrapes, ensureUserHandUploadBlock } from '../lib/soulReportOpenAI';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function generateRealReport() {
  console.log('='.repeat(100));
  console.log('🎯 生成真实的灵魂档案（使用实时截图）');
  console.log('='.repeat(100));

  // 步骤 1: 获取用户数据
  const user = await prisma.user.findUnique({
    where: { email: DEBUG_EMAIL },
  });

  if (!user) {
    console.log('❌ 未找到 debug 用户');
    return;
  }

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n✅ 用户: ${user.email}`);
  console.log(`✅ 上传数据: ${uploads.length} 条\n`);

  // 步骤 2: 完整抓取（包含截图）
  console.log('📡 开始完整抓取（包含实时截图）...\n');
  const scrapes = await scrapeFromPlatformUploads(uploads);

  console.log('\n抓取结果:');
  scrapes.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.platform}: ok=${s.ok}, method=${s.method}, screenshot=${!!s.screenshotDataUrl}`);
  });

  // 步骤 3: 构建 OpenAI 输入
  console.log('\n\n🤖 构建 OpenAI 输入...');

  const userTexts = uploads
    .filter((u) => u.type === 'text' || u.type === 'voice-text')
    .map((u) => u.content || '')
    .filter(Boolean);

  const screenshotCount = uploads.filter((u) => u.type === 'screenshot' && u.url).length;

  const contextParts: string[] = [
    '以下为 SoulMatch 建档材料：各平台绑定后的抓取摘录、用户在应用内的自述，以及手传截图说明。',
  ];

  for (const o of scrapes) {
    const displayName = {
      weibo: '微博',
      xhs: '小红书',
      douyin: '抖音',
      netease: '网易云音乐',
      douban: '豆瓣',
      zhihu: '知乎',
    }[o.platform] || o.platform;

    contextParts.push(
      `\n【${displayName}】\n链接：${o.url}\n抓取结果：${o.ok ? '有正文' : '无有效正文'}（${o.method || 'unknown'}）\n正文摘录：\n${o.excerpt || '（空）'}\n`
    );
  }

  for (const t of userTexts) {
    contextParts.push(`\n【用户自述】\n${t}\n`);
  }

  const context = contextParts.join('');

  // 收集所有截图
  const screenshotDataUrls = scrapes
    .filter(s => s.screenshotDataUrl)
    .map(s => s.screenshotDataUrl!);

  console.log(`✅ 用户文本: ${userTexts.length} 条`);
  console.log(`✅ 平台数据: ${scrapes.length} 个`);
  console.log(`✅ 实时截图: ${screenshotDataUrls.length} 张`);
  console.log(`✅ Context 长度: ${context.length} 字符\n`);

  // 步骤 4: 调用 OpenAI
  console.log('🚀 调用 OpenAI API...\n');

  const apiKey = process.env.OPENAI_API_KEY;
  let report;
  let reportSource;

  if (apiKey) {
    report = await tryOpenAISoulReport(context, screenshotDataUrls);
    reportSource = report ? 'openai' : 'fallback';

    if (report) {
      console.log('✅ OpenAI 调用成功\n');
    } else {
      console.log('❌ OpenAI 调用失败，使用 fallback\n');
      report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
    }
  } else {
    console.log('⚠️  未配置 OPENAI_API_KEY，使用 fallback\n');
    report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
    reportSource = 'fallback';
  }

  report = ensureBlocksCoverAllScrapes(report, scrapes);
  report = ensureUserHandUploadBlock(report, screenshotCount);

  // 步骤 5: 显示结果
  console.log('='.repeat(100));
  console.log('📊 生成的灵魂档案');
  console.log('='.repeat(100));

  console.log('\n🎯 基本信息:');
  console.log(`  MBTI: ${report.mbti}`);
  console.log(`  标题: ${report.title}`);
  console.log(`  标签: ${report.avatarTags.join(', ')}`);
  console.log(`  数据来源: ${reportSource}`);

  console.log('\n📝 总评:');
  console.log('─'.repeat(100));
  console.log(report.overall);
  console.log('─'.repeat(100));

  console.log(`\n📦 数据块 (${report.blocks.length} 个):`);
  report.blocks.forEach((b, i) => {
    console.log(`\n  [${i + 1}] ${b.source}`);
    console.log(`      图标: ${b.icon}`);
    console.log(`      标签: ${b.tags.join(', ')}`);
    console.log(`      标题: ${b.title}`);
    console.log(`      描述: ${b.description.slice(0, 100)}...`);
  });

  // 步骤 6: 保存结果
  const outputPath = path.join(process.cwd(), 'real-report-output.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    user: { id: user.id, email: user.email },
    scrapes: scrapes.map(s => ({
      platform: s.platform,
      ok: s.ok,
      method: s.method,
      excerptLength: s.excerpt.length,
      hasScreenshot: !!s.screenshotDataUrl,
    })),
    screenshotCount: screenshotDataUrls.length,
    report,
    reportSource,
  }, null, 2));

  console.log(`\n\n💾 完整结果已保存到: ${outputPath}`);

  console.log('\n' + '='.repeat(100));
  console.log('✅ 真实灵魂档案生成完成！');
  console.log('='.repeat(100));

  await prisma.$disconnect();
}

generateRealReport().catch(console.error);
