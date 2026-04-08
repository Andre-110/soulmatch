import prisma from '../lib/prisma';
import { scrapeWeibo, scrapeNetease, scrapeDouban, scrapeXhs, scrapeDouyin, scrapeZhihu } from '../lib/profileScrape';
import { tryOpenAISoulReport, buildFallbackSoulReport, ensureBlocksCoverAllScrapes, ensureUserHandUploadBlock } from '../lib/soulReportOpenAI';
import { getSoulReportSystemPrompt } from '../lib/soulReportPrompt';
import fs from 'fs';
import path from 'path';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function visualizeFullFlowNoScreenshot() {
  console.log('='.repeat(100));
  console.log('🎯 完整流程可视化测试（不含截图，使用已有截图）');
  console.log('='.repeat(100));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const screenshotDir = path.join(process.cwd(), 'public', 'debug-screenshots', `analysis_${timestamp}`);

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

  console.log(`✅ 上传数据: ${uploads.length} 条\n`);

  console.log('上传数据详情:');
  uploads.forEach((u, i) => {
    const preview = u.content?.slice(0, 80) || u.url || '(无内容)';
    console.log(`  [${i + 1}] ${u.type.padEnd(20)} | ${preview}...`);
  });

  // ============================================================
  // 步骤 2: 抓取平台数据（仅 API，不截图）
  // ============================================================
  console.log('\n\n📡 步骤 2: 抓取平台数据（仅 API）');
  console.log('-'.repeat(100));

  const scrapes = [];

  for (const upload of uploads) {
    if (!upload.content || !upload.type.startsWith('platform:')) continue;

    const platform = upload.type.slice('platform:'.length);
    let payload;
    try {
      payload = JSON.parse(upload.content);
    } catch {
      continue;
    }

    const { profileUrl, extractedId } = payload;

    console.log(`\n抓取 ${platform.toUpperCase()}...`);

    let result;
    try {
      switch (platform) {
        case 'weibo':
          result = await scrapeWeibo(extractedId, profileUrl);
          break;
        case 'netease':
          result = await scrapeNetease(extractedId, profileUrl);
          break;
        case 'douban':
          result = await scrapeDouban(extractedId, profileUrl);
          break;
        case 'xhs':
          result = await scrapeXhs(extractedId, profileUrl);
          break;
        case 'douyin':
          result = await scrapeDouyin(extractedId, profileUrl);
          break;
        case 'zhihu':
          result = await scrapeZhihu(extractedId, profileUrl);
          break;
        default:
          continue;
      }

      scrapes.push(result);
      console.log(`  状态: ${result.ok ? '✅ 成功' : '❌ 失败'}`);
      console.log(`  方法: ${result.method}`);
      console.log(`  文本长度: ${result.excerpt.length} 字符`);
      if (result.excerpt.length > 0) {
        console.log(`  文本预览: ${result.excerpt.slice(0, 120)}...`);
      }
    } catch (error: any) {
      console.log(`  ❌ 错误: ${error.message}`);
    }
  }

  console.log(`\n✅ 抓取完成: ${scrapes.length} 个平台`);

  // ============================================================
  // 步骤 3: 检查已有截图
  // ============================================================
  console.log('\n\n📸 步骤 3: 检查已有截图');
  console.log('-'.repeat(100));

  const existingScreenshots = fs.existsSync(screenshotDir)
    ? fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png'))
    : [];

  console.log(`✅ 找到 ${existingScreenshots.length} 张已有截图:`);
  existingScreenshots.forEach(f => {
    const stats = fs.statSync(path.join(screenshotDir, f));
    console.log(`  - ${f.padEnd(20)} (${(stats.size / 1024).toFixed(1)} KB)`);
  });

  // 加载截图为 base64
  const screenshotDataUrls: string[] = [];
  for (const filename of existingScreenshots) {
    const filepath = path.join(screenshotDir, filename);
    const buffer = fs.readFileSync(filepath);
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    screenshotDataUrls.push(dataUrl);
  }

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

  console.log('✅ 用户文本:', userTexts.length, '条');
  console.log('✅ 平台数据:', scrapes.length, '个');
  console.log('✅ 截图数量:', screenshotDataUrls.length, '张');
  console.log('✅ Context 长度:', context.length, '字符\n');

  console.log('📝 完整 Context 内容:');
  console.log('─'.repeat(100));
  console.log(context);
  console.log('─'.repeat(100));

  // ============================================================
  // 步骤 5: 显示 System Prompt
  // ============================================================
  console.log('\n\n📜 步骤 5: System Prompt');
  console.log('-'.repeat(100));

  const systemPrompt = getSoulReportSystemPrompt();
  console.log('System Prompt 长度:', systemPrompt.length, '字符\n');
  console.log('📝 完整 System Prompt:');
  console.log('─'.repeat(100));
  console.log(systemPrompt);
  console.log('─'.repeat(100));

  // ============================================================
  // 步骤 6: 调用 OpenAI
  // ============================================================
  console.log('\n\n🚀 步骤 6: 调用 OpenAI API');
  console.log('-'.repeat(100));

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
  console.log('='.repeat(100));

  console.log('\n🎯 档案基本信息:');
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
    console.log(`      描述:`);
    console.log('      ─'.repeat(50));
    console.log(`      ${b.description}`);
    console.log('      ─'.repeat(50));
  });

  if (report.article) {
    console.log('\n📄 长文结构:');
    console.log(`  标题: ${report.article.headline}`);
    console.log(`  保证说明: ${report.article.guaranteeIntro}`);

    console.log(`\n  第一部分: ${report.article.section1.sectionTitle}`);

    if (report.article.section1.corePersonality) {
      console.log(`    核心人格: ${report.article.section1.corePersonality.heading}`);
      console.log(`      支柱数: ${report.article.section1.corePersonality.pillars?.length || 0}`);
    }

    if (report.article.section1.hobbies) {
      console.log(`    兴趣爱好: ${report.article.section1.hobbies.heading}`);
      console.log(`      分组数: ${report.article.section1.hobbies.fixedGroups?.length || 0}`);
    }

    if (report.article.section1.speakingStyle) {
      console.log(`    说话风格: ${report.article.section1.speakingStyle.heading}`);
    }

    if (report.article.section1.values) {
      console.log(`    三观内核: ${report.article.section1.values.heading}`);
      console.log(`      维度数: ${report.article.section1.values.dimensions?.length || 0}`);
    }

    console.log(`\n  第二部分: ${report.article.section2.sectionTitle}`);
    console.log(`    名人数: ${report.article.section2.celebrities.length}`);
    report.article.section2.celebrities.forEach((c, i) => {
      console.log(`    [${i + 1}] ${c.name} - ${c.angle}`);
    });

    console.log(`\n  第三部分: ${report.article.section3.sectionTitle}`);
    console.log(`    分身名: ${report.article.section3.personaName}`);
    console.log(`    时间线: ${report.article.section3.timeline.length} 条`);
    report.article.section3.timeline.forEach((t, i) => {
      console.log(`    [${i + 1}] ${t.clock} - ${t.paragraph.slice(0, 60)}...`);
    });
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
    })),
    context,
    systemPrompt,
    report,
    reportSource,
  }, null, 2));

  console.log(`✅ 完整结果已保存到: ${outputPath}`);

  console.log('\n' + '='.repeat(100));
  console.log('✅ 完整流程可视化测试完成！');
  console.log('='.repeat(100));

  await prisma.$disconnect();
}

visualizeFullFlowNoScreenshot().catch(console.error);
