import prisma from '../lib/prisma';

async function main() {
  console.log('=== Recent Uploads ===');
  const uploads = await prisma.upload.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  uploads.forEach((u) => {
    console.log(`ID: ${u.id}, Type: ${u.type}, Content: ${u.content?.slice(0, 100)}`);
  });

  console.log('\n=== Recent Profiles ===');
  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  profiles.forEach((p) => {
    console.log(`\nProfile ID: ${p.id}`);
    console.log(`MBTI: ${p.outputMbti}`);
    console.log(`Title: ${p.outputTitle}`);
    console.log(`Input data length: ${p.inputData?.length || 0}`);
    console.log(`Result data length: ${p.resultData?.length || 0}`);
    console.log(`Overall: ${p.outputOverall?.slice(0, 100)}`);
  });

  await prisma.$disconnect();
}

main();
