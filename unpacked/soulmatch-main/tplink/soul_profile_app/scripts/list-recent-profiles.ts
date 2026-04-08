/**
 * 查看最新 Profile：规范化列 + 子表；旧数据仅 legacy JSON
 * 用法：cd soul_profile_app && npx tsx scripts/list-recent-profiles.ts [条数，默认 5]
 */
import prisma from '../lib/prisma';
import { soulReportFromNormalized } from '../lib/profilePersist';

const n = Math.min(50, Math.max(1, parseInt(process.argv[2] || '5', 10) || 5));

async function main() {
  const rows = await prisma.profile.findMany({
    orderBy: { createdAt: 'desc' },
    take: n,
    include: {
      inputUploads: { orderBy: { sortOrder: 'asc' } },
      inputScrapes: { orderBy: { sortOrder: 'asc' } },
      inputUserTexts: { orderBy: { sortOrder: 'asc' } },
      inputScreenshotUrls: { orderBy: { sortOrder: 'asc' } },
      outputBlocks: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (rows.length === 0) {
    console.log('暂无 Profile 记录。');
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    console.log('\n==========', i === 0 ? '【最新】' : `#${i + 1}`, '==========');
    console.log('id:       ', r.id);
    console.log('userId:   ', r.userId);
    console.log('createdAt:', r.createdAt.toISOString());

    const hasNormalized =
      r.inputRecordedAt != null ||
      r.outputTitle != null ||
      r.outputBlocks.length > 0;

    if (hasNormalized) {
      console.log('\n--- 输入 · 标量 ---');
      console.log(
        JSON.stringify(
          {
            inputVersion: r.inputVersion,
            inputRecordedAt: r.inputRecordedAt?.toISOString() ?? null,
            inputReportSource: r.inputReportSource,
            inputOpenaiModel: r.inputOpenaiModel,
            inputContextCharLength: r.inputContextCharLength,
            inputScreenshotCount: r.inputScreenshotCount,
            inputVisionImageCount: r.inputVisionImageCount,
          },
          null,
          2,
        ),
      );
      console.log('\n--- 输入 · 子表 inputUploads ---');
      console.log(JSON.stringify(r.inputUploads, null, 2));
      console.log('\n--- 输入 · 子表 inputScrapes ---');
      console.log(JSON.stringify(r.inputScrapes, null, 2));
      console.log('\n--- 输入 · 子表 inputUserTexts ---');
      console.log(JSON.stringify(r.inputUserTexts, null, 2));
      console.log('\n--- 输入 · 子表 inputScreenshotUrls ---');
      console.log(JSON.stringify(r.inputScreenshotUrls, null, 2));

      console.log('\n--- 输出 · 标量 ---');
      console.log(
        JSON.stringify(
          {
            outputMbti: r.outputMbti,
            outputTitle: r.outputTitle,
            outputOverall: r.outputOverall,
            outputAvatarTag1: r.outputAvatarTag1,
            outputAvatarTag2: r.outputAvatarTag2,
            outputAvatarTag3: r.outputAvatarTag3,
          },
          null,
          2,
        ),
      );
      console.log('\n--- 输出 · 子表 outputBlocks ---');
      console.log(JSON.stringify(r.outputBlocks, null, 2));

      const assembled = soulReportFromNormalized(r);
      console.log('\n--- 拼回的 report（与前端结构一致）---');
      console.log(JSON.stringify(assembled, null, 2));
    }

    if (r.inputData || r.resultData) {
      console.log('\n--- 旧版 legacy JSON（仅历史行）---');
      if (r.inputData) console.log('inputData:', r.inputData.slice(0, 500) + (r.inputData.length > 500 ? '…' : ''));
      if (r.resultData)
        console.log('resultData:', r.resultData.slice(0, 500) + (r.resultData.length > 500 ? '…' : ''));
    }

    if (!hasNormalized && !r.resultData) {
      console.log('（无规范化字段且无 legacy，异常行）');
    }
  }

  console.log('\n库文件: prisma/dev.db\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
