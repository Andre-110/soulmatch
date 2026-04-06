import prisma from '../lib/prisma';

async function main() {
  const profile = await prisma.profile.findUnique({
    where: { id: 'cmnmlalaq0002gupqdi8ymy8j' }
  });

  if (profile?.reportArticle) {
    const article = JSON.parse(profile.reportArticle);
    console.log('=== 名人部分 (section2) ===');
    console.log(JSON.stringify(article.section2, null, 2));
    console.log('\n=== 名人数量 ===');
    console.log(article.section2?.celebrities?.length || 0);
  } else {
    console.log('❌ 没有找到 reportArticle');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
