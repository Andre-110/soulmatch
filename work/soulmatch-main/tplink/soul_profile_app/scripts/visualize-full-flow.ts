import prisma from '../lib/prisma';
import { scrapeFromPlatformUploads } from '../lib/profileScrape';
import { tryOpenAISoulReport, buildFallbackSoulReport, ensureBlocksCoverAllScrapes, ensureUserHandUploadBlock } from '../lib/soulReportOpenAI';
import { getSoulReportSystemPrompt } from '../lib/soulReportPrompt';
import fs from 'fs';
import path from 'path';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function visualizeFullFlow() {
  console.log('='.repeat(100));
  console.log('🎯 完整流程可视化测试');
  console.log('='.repeat(100));

  // ============================================================
  // 步骤 1: 获取用户数据
  // ============================================================
  console.log('\n📋 步骤 1: 获取用户数据');
  console.log('-'.repeat(100));

  const user = await prisma.user.findUnique({
    where: { email: DEBUG_EMAIL },
  });

  if (!user) {
    console.log('❌ 未找到 debug 用户');
    return;
  }

  console.log(`✅ 用户 ID: ${user.id}`);
  console.log(`✅ 用户邮箱: ${user.email}`);

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`✅ 上传数据: ${uploads.length} 条`);
  console.log('\n上传数据详情:');
  uploads.forEach((u, i) => {
    console.log(`  [${i + 1}] ${u.type.padEnd(20)} | ${u.content?.slice(0, 60) || u.url || '(无内容)'}...`);
  });

  // ============================================================
  // 步骤 2: 抓取平台数据
  // ============================================================
  console.log('\n\n📡 步骤 2: 抓取平台数据');
  console.log('-'.repeat(100));

  const scrapes = await scrapeFromPlatformUploads(uploads);

  console.log(`✅ 抓取完成: ${scrapes.length} 个平台`);
  console.log('\n抓取结果详情:');
  scrapes.forEach((s, i) => {
    console.log(`\n  [${i + 1}] ${s.platform.toUpperCase()}`);
    console.log(`      URL: ${s.url}`);
    console.log(`      状态: ${s.ok ? '✅ 成功' : '❌ 失败'}`);
    console.log(`      方法: ${s.method}`);
    console.log(`      文本长度: ${s.excerpt.length} 字符`);
    console.log(`      有截图: ${s.screenshotDataUrl ? '✅ 是' : '❌ 否'}`);
    if (s.excerpt.length > 0) {
      console.log(`      文本预览: ${s.excerpt.slice(0, 150)}...`);
    }
  });

  // ============================================================
  // 步骤 3: 保存截图到文件
  // ============================================================
  console.log('\n\n📸 步骤 3: 保存截图');
  console.log('-'.repeat(100));

  const screenshotDir = path.join(process.cwd(), 'public', 'debug-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotPaths: string[] = [];
  scrapes.forEach((s) => {
    if (s.screenshotDataUrl) {
      const base64Data = s.screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${s.platform}.png`;
      const filepath = path.join(screenshotDir, filename);
      fs.writeFileSync(filepath, buffer);
      screenshotPaths.push(filepath);
      console.log(`  ✅ ${s.platform.padEnd(10)} → ${filepath}`);
    }
  });

  console.log(`\n✅ 保存了 ${screenshotPaths.length} 张截图`);

  // ============================================================
  // 步骤 4: 构建 OpenAI 输入
  // ============================================================
  console.log('\n\n🤖 步骤 4: 构建 OpenAI 输入');
  console.log('-'.repeat(100));

  const userTexts = uploads
    .filter((u) => u.type === 'text' || u.type === 'voice-text')
    .map((u) => u.content || '')
    .filter(Boolean);

  const screenshotCount = uploads.filter((u) => u.type === 'screenshot' && u.url).length;

  const contextParts: string[] = [
    '以下为 SoulMatch 建档材料：各平台绑定后的抓取摘录、用户在应用内的自述，以及手传截图说明。【多模态图片顺序】本请求附带的图片依次为：先按抓取顺序排列的各平台 Playwright 截图（每个绑定源至多一张，无则跳过），再按上传时间顺序的建档步骤手传截图。解读「你上传的截图·视觉线索」时请以该顺序后半段、与【用户手传截图】张数对应的图片为准，勿与平台截图混淆。',
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

  if (screenshotCount > 0) {
    contextParts.push(
      `\n【用户手传截图】共 ${screenshotCount} 张（建档第一步上传，已随本请求以图片消息附在文字材料之后）。必须为这些图片写一个独立 block（source 含「你上传的截图·视觉线索」），描述可见的界面、文字与气质。\n`,
    );
  }

  const context = contextParts.join('');

  console.log('✅ 用户文本:', userTexts.length, '条');
  console.log('✅ 用户截图:', screenshotCount, '张');
  console.log('✅ 平台截图:', scrapes.filter(s => s.screenshotDataUrl).length, '张');
  console.log('✅ Context 长度:', context.length, '字符');

  console.log('\n📝 Context 内容预览:');
  console.log(context.slice(0, 500) + '...\n');

  // ============================================================
  // 步骤 5: 显示 System Prompt
  // ============================================================
  console.log('\n\n📜 步骤 5: System Prompt');
  console.log('-'.repeat(100));

  const systemPrompt = getSoulReportSystemPrompt();
  console.log('System Prompt 长度:', systemPrompt.length, '字符');
  console.log('\nSystem Prompt 内容预览:');
  console.log(systemPrompt.slice(0, 500) + '...\n');

  // ============================================================
  // 步骤 6: 调用 OpenAI
  // ============================================================
  console.log('\n\n🚀 步骤 6: 调用 OpenAI API');
  console.log('-'.repeat(100));

  const screenshotDataUrls: string[] = scrapes
    .filter((o) => o.screenshotDataUrl)
    .map((o) => o.screenshotDataUrl as string);

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log('API Key:', apiKey ? `✅ 已配置 (${apiKey.slice(0, 10)}...)` : '❌ 未配置');
  console.log('模型:', model);
  console.log('图片数量:', screenshotDataUrls.length);

  let report;
  let reportSource;

  if (apiKey) {
    console.log('\n⏳ 正在调用 OpenAI...');
    report = await tryOpenAISoulReport(context, screenshotDataUrls);
    reportSource = report ? 'openai' : 'fallback';

    if (report) {
      console.log('✅ OpenAI 调用成功');
    } else {
      console.log('❌ OpenAI 调用失败，使用 fallback');
      report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
    }
  } else {
    console.log('⚠️  未配置 OPENAI_API_KEY，使用 fallback');
    report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
    reportSource = 'fallback';
  }

  report = ensureBlocksCoverAllScrapes(report, scrapes);
  report = ensureUserHandUploadBlock(report, screenshotCount);

  // ============================================================
  // 步骤 7: 显示输出结果
  // ============================================================
  console.log('\n\n📊 步骤 7: 输出结果');
  console.log('-'.repeat(100));

  console.log('\n🎯 档案基本信息:');
  console.log(`  MBTI: ${report.mbti}`);
  console.log(`  标题: ${report.title}`);
  console.log(`  标签: ${report.avatarTags.join(', ')}`);
  console.log(`  数据来源: ${reportSource}`);

  console.log('\n📝 总评:');
  console.log(`  ${report.overall}`);

  console.log('\n📦 数据块 (${report.blocks.length} 个):');
  report.blocks.forEach((b, i) => {
    console.log(`\n  [${i + 1}] ${b.source}`);
    console.log(`      图标: ${b.icon}`);
    console.log(`      标签: ${b.tags.join(', ')}`);
    console.log(`      标题: ${b.title}`);
    console.log(`      描述: ${b.description.slice(0, 100)}...`);
  });

  if (report.article) {
    console.log('\n📄 长文结构:');
    console.log(`  标题: ${report.article.headline}`);
    console.log(`  副标题: ${report.article.subheadline}`);
    console.log(`  引言: ${report.article.leadParagraph.slice(0, 100)}...`);
    console.log(`\n  第一部分: ${report.article.section1.sectionTitle}`);
    console.log(`    段落数: ${report.article.section1.paragraphs.length}`);
    console.log(`\n  第二部分: ${report.article.section2.sectionTitle}`);
    console.log(`    名人数: ${report.article.section2.celebrities.length}`);
    console.log(`\n  第三部分: ${report.article.section3.sectionTitle}`);
    console.log(`    时间线: ${report.article.section3.timeline.length} 条`);
  }

  // ============================================================
  // 步骤 8: 保存结果
  // ============================================================
  console.log('\n\n💾 步骤 8: 保存结果');
  console.log('-'.repeat(100));

  const outputPath = path.join(process.cwd(), 'debug-output.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    user: { id: user.id, email: user.email },
    uploads: uploads.length,
    scrapes: scrapes.map(s => ({
      platform: s.platform,
      ok: s.ok,
      method: s.method,
      excerptLength: s.excerpt.length,
      hasScreenshot: !!s.screenshotDataUrl,
    })),
    context: context.slice(0, 1000) + '...',
    systemPrompt: systemPrompt.slice(0, 500) + '...',
    report,
    reportSource,
  }, null, 2));

  console.log(`✅ 完整结果已保存到: ${outputPath}`);
  console.log(`✅ 截图已保存到: ${screenshotDir}`);

  console.log('\n' + '='.repeat(100));
  console.log('✅ 完整流程可视化测试完成！');
  console.log('='.repeat(100));

  await prisma.$disconnect();
}

visualizeFullFlow().catch(console.error);
