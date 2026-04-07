import prisma from '../lib/prisma';
import { scrapeFromPlatformUploads } from '../lib/profileScrape';
import { tryOpenAISoulReport, ensureBlocksCoverAllScrapes, ensureUserHandUploadBlock } from '../lib/soulReportOpenAI';
import { buildProfileNormalizedCreate } from '../lib/profilePersist';
import { buildSoulReportInputRecord } from '../lib/soulReportRecord';
import { resolveMbtiIpFromReport } from '../lib/mbtiIpIndex';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: DEBUG_EMAIL },
  });

  if (!user) {
    console.log('Debug user not found');
    return;
  }

  console.log('Creating full profile with OpenAI...\n');

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  const scrapes = await scrapeFromPlatformUploads(uploads);
  const userTexts = uploads
    .filter((u) => u.type === 'text' || u.type === 'voice-text')
    .map((u) => u.content || '')
    .filter(Boolean);
  const screenshotCount = uploads.filter((u) => u.type === 'screenshot' && u.url).length;

  const contextParts: string[] = [
    '以下为 SoulMatch 建档材料：各平台绑定后的抓取摘录、用户在应用内的自述，以及手传截图说明。',
  ];
  for (const o of scrapes) {
    contextParts.push(
      `\n【${o.platform}】\n链接：${o.url}\n抓取结果：${o.ok ? '有正文' : '无有效正文'}\n正文摘录：\n${o.excerpt || '（空）'}\n`
    );
  }
  for (const t of userTexts) {
    contextParts.push(`\n【用户自述】\n${t}\n`);
  }
  const context = contextParts.join('');

  const screenshotDataUrls: string[] = scrapes
    .filter((o) => o.screenshotDataUrl)
    .map((o) => o.screenshotDataUrl as string);

  console.log(`Calling OpenAI with ${screenshotDataUrls.length} screenshots...`);

  let report = await tryOpenAISoulReport(context, screenshotDataUrls);
  const reportSource = report ? 'openai' : 'fallback';

  if (!report) {
    console.log('OpenAI failed, using fallback');
    return;
  }

  report = ensureBlocksCoverAllScrapes(report, scrapes);
  report = ensureUserHandUploadBlock(report, screenshotCount);

  const inputRecord = buildSoulReportInputRecord({
    uploads,
    scrapes,
    userTexts,
    userScreenshotUrls: [],
    screenshotCount,
    visionImageCount: screenshotDataUrls.length,
    context,
    reportSource,
    openaiModel: 'gpt-4o-mini',
  });

  const profile = await prisma.profile.create({
    data: buildProfileNormalizedCreate({
      userId: user.id,
      input: inputRecord,
      report,
    }),
  });

  const mbtiIp = resolveMbtiIpFromReport(report.mbti);

  console.log('\n✅ Profile created successfully!');
  console.log(`Profile ID: ${profile.id}`);
  console.log(`MBTI: ${report.mbti} → IP: ${mbtiIp.code}`);
  console.log(`Title: ${report.title}`);
  console.log(`Blocks: ${report.blocks.length}`);
  console.log(`Article: ${report.article ? 'YES' : 'NO'}`);

  if (report.article) {
    const articleAny = report.article as any;
    const legacyTimelineLen = Array.isArray(articleAny?.section3?.timeline)
      ? articleAny.section3.timeline.length
      : 0;
    const dayPartsLen = Array.isArray(articleAny?.section4?.dayParts)
      ? articleAny.section4.dayParts.length
      : 0;
    console.log(`\nArticle structure:`);
    console.log(`  Headline: ${report.article.headline}`);
    if (articleAny?.section1?.sectionTitle) {
      console.log(`  Section 1: ${articleAny.section1.sectionTitle}`);
    }
    if (articleAny?.section2?.sectionTitle) {
      console.log(`  Section 2: ${articleAny.section2.sectionTitle}`);
    }
    if (articleAny?.section3?.sectionTitle) {
      console.log(`  Section 3: ${articleAny.section3.sectionTitle}`);
    }
    if (articleAny?.section4?.sectionTitle) {
      console.log(`  Section 4: ${articleAny.section4.sectionTitle}`);
    }
    console.log(`  Celebrities: ${report.article.section2.celebrities.length}`);
    console.log(`  Timeline(dayParts): ${dayPartsLen} entries`);
    if (legacyTimelineLen > 0) {
      console.log(`  Timeline(legacy): ${legacyTimelineLen} entries`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
