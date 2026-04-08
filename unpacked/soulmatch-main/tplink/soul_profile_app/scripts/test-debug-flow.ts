import prisma from '../lib/prisma';

const DEBUG_EMAIL = 'debug@soulmatch.local';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: DEBUG_EMAIL },
  });

  if (!user) {
    console.log('Debug user not found');
    return;
  }

  console.log('Testing platform binding simulation...\n');

  // Simulate what the frontend does
  const platforms = [
    { id: 'weibo', url: 'https://weibo.com/u/7487955617', extractedId: '7487955617' },
    { id: 'xhs', url: 'https://www.xiaohongshu.com/search_result?keyword=416227302&source=web_explore_feed', extractedId: '416227302' },
    { id: 'douyin', url: 'https://www.douyin.com/user/MS4wLjABAAAAExamplePlaceholder000000000000', extractedId: 'MS4wLjABAAAAExamplePlaceholder000000000000' },
    { id: 'netease', url: 'https://music.163.com/#/user/home?id=530688535', extractedId: '530688535' },
    { id: 'douban', url: 'https://www.douban.com/people/26863705/', extractedId: '26863705' },
    { id: 'zhihu', url: 'https://www.zhihu.com/people/example-user', extractedId: 'example-user' },
  ];

  for (const p of platforms) {
    const payload = JSON.stringify({
      profileUrl: p.url,
      extractedId: p.extractedId,
      platform: p.id,
    });

    await prisma.upload.create({
      data: {
        userId: user.id,
        type: `platform:${p.id}`,
        content: payload,
      },
    });
    console.log(`✓ Created upload for ${p.id}`);
  }

  // Add text uploads
  await prisma.upload.create({
    data: {
      userId: user.id,
      type: 'text',
      content: '【Debug 模式】这是一段用于快速联调的心声示例。',
    },
  });
  console.log('✓ Created text upload');

  await prisma.upload.create({
    data: {
      userId: user.id,
      type: 'voice-text',
      content: '【Debug】如果明天世界末日，今晚想好好吃一顿、和在乎的人待在一起。',
    },
  });
  console.log('✓ Created voice-text upload');

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
  });

  console.log(`\nTotal uploads: ${uploads.length}`);
  console.log('Platform uploads:', uploads.filter(u => u.type.startsWith('platform:')).length);

  await prisma.$disconnect();
}

main();
