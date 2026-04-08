import { scrapeFromPlatformUploads } from '../lib/profileScrape';
import prisma from '../lib/prisma';
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

  console.log('Fetching uploads and scraping...\n');

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  const scrapes = await scrapeFromPlatformUploads(uploads);

  const outputDir = path.join(process.cwd(), 'public', 'debug-screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Saving screenshots...\n');

  for (const scrape of scrapes) {
    if (scrape.screenshotDataUrl) {
      // Extract base64 data
      const matches = scrape.screenshotDataUrl.match(/^data:image\/png;base64,(.+)$/);
      if (matches && matches[1]) {
        const base64Data = matches[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `${scrape.platform}.png`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, buffer);
        console.log(`✓ Saved: /debug-screenshots/${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
      }
    } else {
      console.log(`✗ No screenshot for ${scrape.platform}`);
    }
  }

  console.log('\n访问这些 URL 查看截图：');
  scrapes.forEach(s => {
    if (s.screenshotDataUrl) {
      console.log(`  http://localhost:3000/debug-screenshots/${s.platform}.png`);
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);
