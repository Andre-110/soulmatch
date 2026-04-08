import prisma from '../lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'debug@soulmatch.local' }
  });

  if (!user) {
    console.log('❌ 未找到 debug 用户');
    return;
  }

  console.log(`✅ 用户: ${user.email} (${user.id})\n`);

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });

  console.log('📋 平台 ID 列表:\n');
  uploads.forEach(u => {
    if (u.type.startsWith('platform:')) {
      try {
        const content = JSON.parse(u.content || '{}');
        console.log(`${u.type.padEnd(20)} | ID: ${content.extractedId?.padEnd(30) || '(无)'} | URL: ${content.profileUrl}`);
      } catch {
        console.log(`${u.type.padEnd(20)} | 解析失败`);
      }
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);
