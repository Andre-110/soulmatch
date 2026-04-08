import prisma from '../lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'debug@soulmatch.local' }
  });

  if (!user) {
    console.log('❌ 未找到 debug 用户');
    return;
  }

  // 查找网易云的上传记录
  const neteaseUpload = await prisma.upload.findFirst({
    where: {
      userId: user.id,
      type: 'platform:netease'
    }
  });

  if (!neteaseUpload) {
    console.log('❌ 未找到网易云上传记录');
    return;
  }

  const oldContent = JSON.parse(neteaseUpload.content || '{}');
  console.log('旧内容:', oldContent);

  // 更新为正确的 ID
  const newContent = {
    ...oldContent,
    extractedId: '530688535',
    profileUrl: 'https://music.163.com/#/user/home?id=530688535'
  };

  await prisma.upload.update({
    where: { id: neteaseUpload.id },
    data: { content: JSON.stringify(newContent) }
  });

  console.log('✅ 已更新网易云 ID 为: 530688535');

  await prisma.$disconnect();
}

main().catch(console.error);
