import prisma from '../lib/prisma';
import { scrapeFromPlatformUploads } from '../lib/profileScrape';
import { tryOpenAISoulReport, ensureBlocksCoverAllScrapes, ensureUserHandUploadBlock } from '../lib/soulReportOpenAI';
import fs from 'fs';
import path from 'path';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: DEBUG_EMAIL },
  });

  if (!user) {
    console.log('Debug user not found');
    return;
  }

  console.log('Testing OpenAI report generation...\n');

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Uploads: ${uploads.length}`);

  const scrapes = await scrapeFromPlatformUploads(uploads);
  console.log(`Scrapes: ${scrapes.length}`);

  const userTexts = uploads
    .filter((u) => u.type === 'text' || u.type === 'voice-text')
    .map((u) => u.content || '')
    .filter(Boolean);

  const screenshotCount = uploads.filter((u) => u.type === 'screenshot' && u.url).length;

  // Build context
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

  // Get screenshots
  const screenshotDataUrls: string[] = scrapes
    .filter((o) => o.screenshotDataUrl)
    .map((o) => o.screenshotDataUrl as string);

  console.log(`\nContext length: ${context.length} chars`);
  console.log(`Screenshots: ${screenshotDataUrls.length}`);
  console.log(`\nCalling OpenAI API...`);

  const report = await tryOpenAISoulReport(context, screenshotDataUrls);

  if (!report) {
    console.log('❌ OpenAI API call failed');
    return;
  }

  console.log('\n✅ OpenAI report generated!');
  console.log(`MBTI: ${report.mbti}`);
  console.log(`Title: ${report.title}`);
  console.log(`Blocks: ${report.blocks.length}`);
  console.log(`\nBlocks:`);
  report.blocks.forEach((b, i) => {
    console.log(`  [${i}] ${b.source} - ${b.title.slice(0, 60)}`);
  });

  console.log(`\nOverall: ${report.overall.slice(0, 200)}...`);

  await prisma.$disconnect();
}

main().catch(console.error);
