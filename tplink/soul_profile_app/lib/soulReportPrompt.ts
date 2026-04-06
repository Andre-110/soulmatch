import fs from 'fs';
import path from 'path';

const PROMPT_DIR = path.join(process.cwd(), 'lib/prompts/soul-report');

function buildSoulReportSystemPrompt(): string {
  const instructions = fs.readFileSync(path.join(PROMPT_DIR, 'system-instructions.md'), 'utf8');
  const contract = fs.readFileSync(path.join(PROMPT_DIR, 'output-contract.json'), 'utf8');
  return [
    instructions.trim(),
    '',
    '---',
    '',
    '【输出契约】只输出一个 JSON 对象（不要 markdown 代码块）。根对象必须严格具备下列键与嵌套结构；字段含义见上文「写作指令」。',
    contract.trim(),
    '',
    '硬约束：celebrities 数组长度必须 = 3；timeline 数组长度 ≥ 8；全程中文。',
  ].join('\n');
}

let cachedPrompt: string | null = null;

/**
 * Soul 报告 system 消息全文：写作指令（Markdown）+ 输出契约（JSON 形状）。
 * 固定文案与结构在 `lib/prompts/soul-report/`，业务代码只调用本函数，不在 TS 里手写长 prompt。
 */
export function getSoulReportSystemPrompt(): string {
  if (!cachedPrompt) cachedPrompt = buildSoulReportSystemPrompt();
  return cachedPrompt;
}
