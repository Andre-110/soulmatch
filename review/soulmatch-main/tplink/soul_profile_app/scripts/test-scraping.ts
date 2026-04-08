import prisma from '../lib/prisma';
import { scrapeFromPlatformUploads } from '../lib/profileScrape';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: DEBUG_EMAIL },
  });

  if (!user) {
    console.log('Debug user not found');
    return;
  }

  console.log('Testing scraping logic...\n');

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total uploads: ${uploads.length}`);
  console.log(`Platform uploads: ${uploads.filter(u => u.type.startsWith('platform:')).length}\n`);

  console.log('Calling scrapeFromPlatformUploads...');
  const scrapes = await scrapeFromPlatformUploads(uploads);

  console.log(`\nScrapes returned: ${scrapes.length}`);
  scrapes.forEach((s, i) => {
    console.log(`\n[${i}] ${s.platform} - ${s.url}`);
    console.log(`  OK: ${s.ok}`);
    console.log(`  Method: ${s.method}`);
    console.log(`  Excerpt length: ${s.excerpt.length}`);
    console.log(`  Has screenshot: ${!!s.screenshotDataUrl}`);
    if (s.excerpt.length > 0) {
      console.log(`  Excerpt preview: ${s.excerpt.slice(0, 100)}...`);
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);
