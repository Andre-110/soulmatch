import { searchDouyinUser } from './lib/douyinAutomation';

async function testDouyinAutomation() {
  console.log('开始测试抖音自动化搜索...');

  // 测试一个抖音号
  const testUserId = 'douyin123456';

  const result = await searchDouyinUser(testUserId);

  if (result.success) {
    console.log('✅ 搜索成功！');
    console.log('用户主页:', result.profileUrl);
  } else {
    console.log('❌ 搜索失败:', result.error);
  }
}

testDouyinAutomation().catch(console.error);
