import { scrapeXhs } from '../lib/profileScrape';

async function test() {
  console.log('测试小红书新方法集成...\n');
  
  const result = await scrapeXhs('416227302', 'https://www.xiaohongshu.com/user/profile/5b9e677c4a74c100017f3145');
  
  console.log('结果:');
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
