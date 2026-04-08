import prisma from '../lib/prisma';

async function main() {
  // Get the most recent user
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!user) {
    console.log('No users found');
    return;
  }

  console.log('Testing with user:', user.email);

  // Check uploads
  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nFound ${uploads.length} uploads:`);
  uploads.forEach((u) => {
    console.log(`  - ${u.type}: ${u.content?.slice(0, 80)}`);
  });

  // Simulate what analyze route does
  const platformUploads = uploads.filter((u) => u.type.startsWith('platform:'));
  console.log(`\nPlatform uploads: ${platformUploads.length}`);
  platformUploads.forEach((u) => {
    const platform = u.type.slice('platform:'.length);
    console.log(`  - Platform: ${platform}`);
    try {
      const payload = JSON.parse(u.content || '{}');
      console.log(`    URL: ${payload.profileUrl}`);
      console.log(`    ID: ${payload.extractedId}`);
    } catch (e) {
      console.log(`    Failed to parse: ${u.content}`);
    }
  });

  await prisma.$disconnect();
}

main();
