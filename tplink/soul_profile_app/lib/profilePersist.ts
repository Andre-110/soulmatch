import type { SoulReport } from '@/lib/soulReportOpenAI';
import type { SoulReportInputRecord } from '@/lib/soulReportRecord';
import type { Prisma } from '@prisma/client';

function padAvatarTags(tags: string[]): [string | null, string | null, string | null] {
  const a = [...tags].slice(0, 3);
  while (a.length < 3) a.push('');
  return [a[0] || null, a[1] || null, a[2] || null];
}

/** 将单次分析结果写入 Profile 的嵌套结构（列 + 子表，不再依赖整段 JSON） */
export function buildProfileNormalizedCreate(params: {
  userId: string;
  input: SoulReportInputRecord;
  report: SoulReport;
}): Prisma.ProfileCreateInput {
  const { userId, input, report } = params;
  const [outputAvatarTag1, outputAvatarTag2, outputAvatarTag3] = padAvatarTags(
    Array.isArray(report.avatarTags) ? report.avatarTags : [],
  );

  return {
    user: { connect: { id: userId } },
    inputVersion: input.version,
    inputRecordedAt: new Date(input.recordedAt),
    inputReportSource: input.reportSource,
    inputOpenaiModel: input.openaiModel ?? null,
    inputContextCharLength: input.contextCharLength,
    inputScreenshotCount: input.screenshotCount,
    inputVisionImageCount: input.visionImageCount,
    inputData: null,
    resultData: report.article ? JSON.stringify({ v: 2, article: report.article }) : null,
    outputMbti: report.mbti,
    outputTitle: report.title,
    outputOverall: report.overall,
    outputAvatarTag1,
    outputAvatarTag2,
    outputAvatarTag3,
    inputUploads: {
      create: input.uploads.map((u, i) => ({
        sortOrder: i,
        uploadId: u.id,
        type: u.type,
        content: u.content,
        url: u.url,
      })),
    },
    inputScrapes: {
      create: input.scrapes.map((s, i) => ({
        sortOrder: i,
        platform: s.platform,
        url: s.url,
        ok: s.ok,
        method: s.method ?? null,
        excerpt: s.excerpt,
        hasPlatformScreenshot: s.hasPlatformScreenshot,
      })),
    },
    inputUserTexts: {
      create: input.userTexts.map((content, i) => ({
        sortOrder: i,
        content,
      })),
    },
    inputScreenshotUrls: {
      create: input.userScreenshotUrls.map((url, i) => ({
        sortOrder: i,
        url,
      })),
    },
    outputBlocks: {
      create: report.blocks.map((b, i) => ({
        sortOrder: i,
        source: b.source,
        icon: b.icon,
        tag1: b.tags?.[0] ?? null,
        tag2: b.tags?.[1] ?? null,
        title: b.title,
        description: b.description,
      })),
    },
  };
}

/** 从规范化存储拼回 SoulReport（供将来读库接口使用） */
export function soulReportFromNormalized(p: {
  outputMbti: string | null;
  outputTitle: string | null;
  outputOverall: string | null;
  outputAvatarTag1: string | null;
  outputAvatarTag2: string | null;
  outputAvatarTag3: string | null;
  outputBlocks: { sortOrder: number; source: string; icon: string; tag1: string | null; tag2: string | null; title: string; description: string }[];
}): SoulReport {
  const tags = [p.outputAvatarTag1, p.outputAvatarTag2, p.outputAvatarTag3].filter(
    (t): t is string => !!t && t.length > 0,
  );
  const blocks = [...p.outputBlocks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({
      source: b.source,
      icon: b.icon,
      tags: [b.tag1, b.tag2].filter((t): t is string => !!t && t.length > 0),
      title: b.title,
      description: b.description,
    }));
  return {
    mbti: p.outputMbti ?? '-',
    title: p.outputTitle ?? '',
    avatarTags: tags.length ? tags : [],
    blocks,
    overall: p.outputOverall ?? '',
  };
}
