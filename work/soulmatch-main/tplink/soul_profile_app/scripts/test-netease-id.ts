import { scrapeNetease } from '../lib/profileScrape';

async function main() {
  console.log('测试网易云 ID: 530688535\n');

  const result = await scrapeNetease('530688535', 'https://music.163.com/#/user/home?id=530688535');

  console.log('结果:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
