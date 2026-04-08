import prisma from '../lib/prisma';
import { scrapeFromPlatformUploads } from '../lib/profileScrape';
import { buildFallbackSoulReport, ensureBlocksCoverAllScrapes, ensureUserHandUploadBlock } from '../lib/soulReportOpenAI';
import { buildProfileNormalizedCreate } from '../lib/profilePersist';
import { buildSoulReportInputRecord } from '../lib/soulReportRecord';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: DEBUG_EMAIL },
  });

  if (!user) {
    console.log('Debug user not found');
    return;
  }

  console.log('Testing full analyze flow...\n');

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
  console.log(`User texts: ${userTexts.length}`);

  const screenshotCount = uploads.filter((u) => u.type === 'screenshot' && u.url).length;
  console.log(`Screenshots: ${screenshotCount}`);

  // Build context (simplified - no images)
  const context = `Test context with ${scrapes.length} scrapes and ${userTexts.length} texts`;

  // Build fallback report (no OpenAI)
  let report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
  console.log(`\nInitial report blocks: ${report.blocks.length}`);

  report = ensureBlocksCoverAllScrapes(report, scrapes);
  console.log(`After ensureBlocksCoverAllScrapes: ${report.blocks.length}`);

  report = ensureUserHandUploadBlock(report, screenshotCount);
  console.log(`After ensureUserHandUploadBlock: ${report.blocks.length}`);

  console.log(`\nReport MBTI: ${report.mbti}`);
  console.log(`Report title: ${report.title}`);
  console.log(`\nBlocks:`);
  report.blocks.forEach((b, i) => {
    console.log(`  [${i}] ${b.source} - ${b.title.slice(0, 60)}`);
  });

  const inputRecord = buildSoulReportInputRecord({
    uploads,
    scrapes,
    userTexts,
    userScreenshotUrls: [],
    screenshotCount,
    visionImageCount: 0,
    context,
    reportSource: 'fallback',
  });

  console.log(`\nCreating profile...`);
  const profile = await prisma.profile.create({
    data: buildProfileNormalizedCreate({
      userId: user.id,
      input: inputRecord,
      report,
    }),
    include: {
      inputScrapes: true,
      outputBlocks: true,
    },
  });

  console.log(`✓ Profile created: ${profile.id}`);
  console.log(`  Input scrapes: ${profile.inputScrapes.length}`);
  console.log(`  Output blocks: ${profile.outputBlocks.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
