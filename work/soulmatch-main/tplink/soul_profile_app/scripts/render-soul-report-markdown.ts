/**
 * 将 SoulReport JSON（含 article）渲染为「全维度精准解码」风格 Markdown。
 *
 * 用法：
 *   npx tsx scripts/render-soul-report-markdown.ts <report.json>
 *   cat report.json | npx tsx scripts/render-soul-report-markdown.ts
 *
 * 输入可为整份 SoulReport，或 { "report": { ... } } 包装。
 */
import fs from 'fs';
import type { SoulReport } from '@/lib/soulReportOpenAI';
import { renderSoulReportToMarkdown } from '@/lib/soulReportArticleMarkdown';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    process.stdin.on('data', (c: string | Uint8Array) =>
      chunks.push(typeof c === 'string' ? Buffer.from(c) : c),
    );
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const pathArg = process.argv[2];
  const raw = pathArg
    ? fs.readFileSync(pathArg, 'utf8')
    : process.stdin.isTTY
      ? (console.error('用法: npx tsx scripts/render-soul-report-markdown.ts <report.json>'), process.exit(1), '')
      : await readStdin();

  const data = JSON.parse(raw) as { report?: SoulReport } & SoulReport;
  const report = (data.report ?? data) as SoulReport;
  process.stdout.write(renderSoulReportToMarkdown(report));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
