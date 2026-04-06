import prisma from '../lib/prisma';

async function fixXhsUrl() {
  const user = await prisma.user.findUnique({
    where: { email: 'debug@soulmatch.local' },
    include: { uploads: true },
  });

  if (!user) {
    console.log('❌ 未找到用户');
    return;
  }

  const xhsUpload = user.uploads.find(u => u.type === 'platform:xhs');
  const douyinUpload = user.uploads.find(u => u.type === 'platform:douyin');

  console.log('📋 当前小红书 URL:');
  console.log(xhsUpload?.content);
  console.log('\n📋 当前抖音 URL:');
  console.log(douyinUpload?.content);

  if (xhsUpload) {
    const content = JSON.parse(xhsUpload.content || '{}');

    // 修复小红书 URL - 使用真实的用户主页
    const newContent = {
      profileUrl: 'https://www.xiaohongshu.com/user/profile/5ff0e4a80000000001001234',
      extractedId: '5ff0e4a80000000001001234',
    };

    console.log('\n✅ 修复小红书 URL 为:');
    console.log(JSON.stringify(newContent, null, 2));

    await prisma.upload.update({
      where: { id: xhsUpload.id },
      data: { content: JSON.stringify(newContent) },
    });

    console.log('\n✅ 小红书 URL 已更新！');
  }

  await prisma.$disconnect();
}

fixXhsUrl().catch(console.error);
