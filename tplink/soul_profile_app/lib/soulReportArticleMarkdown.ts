import type { SoulReport } from '@/lib/soulReportOpenAI';
import { stubArticleFromLegacy } from '@/lib/soulReportArticle';

function esc(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

/** 将结构化报告转为与产品示例一致的 Markdown 长文（无 article 时从 blocks+overall 兜底）。 */
export function renderSoulReportToMarkdown(report: SoulReport): string {
  const article = report.article ?? stubArticleFromLegacy(report);
  const a = article;
  const lines: string[] = [];

  lines.push(`# ${esc(a.headline)}`);
  lines.push('');
  lines.push(esc(a.guaranteeIntro));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`## ${esc(a.section1.sectionTitle)}`);
  lines.push('');
  lines.push(`### ${esc(a.section1.corePersonality.heading)}`);
  lines.push('#### 实锤细节支撑：');
  lines.push('');
  let pIdx = 1;
  for (const pillar of a.section1.corePersonality.pillars) {
    lines.push(`${pIdx}.  **${esc(pillar.label)}**`);
    for (const b of pillar.bullets) {
      lines.push(`    - ${esc(b)}`);
    }
    lines.push('');
    pIdx++;
  }

  lines.push(`### ${esc(a.section1.hobbies.heading)}`);
  let hIdx = 1;
  for (const g of a.section1.hobbies.fixedGroups) {
    lines.push(`${hIdx}.  **${esc(g.groupTitle)}**`);
    for (const b of g.bullets) {
      lines.push(`    - ${esc(b)}`);
    }
    lines.push('');
    hIdx++;
  }
  if (a.section1.hobbies.casualBullets.length) {
    lines.push(`${hIdx}.  **日常休闲与延伸**`);
    for (const b of a.section1.hobbies.casualBullets) {
      lines.push(`    - ${esc(b)}`);
    }
    lines.push('');
  }

  lines.push(`### ${esc(a.section1.speakingStyle.heading)}`);
  if (a.section1.speakingStyle.evidenceNote) {
    lines.push(`#### ${esc(a.section1.speakingStyle.evidenceNote)}`);
    lines.push('');
  }
  lines.push(`1.  **核心调性**：${esc(a.section1.speakingStyle.coreTone)}`);
  lines.push('2.  **专属表达细节**');
  for (const b of a.section1.speakingStyle.detailBullets) {
    lines.push(`    - ${esc(b)}`);
  }
  lines.push('');

  lines.push(`### ${esc(a.section1.values.heading)}`);
  let vIdx = 1;
  for (const d of a.section1.values.dimensions) {
    lines.push(`${vIdx}.  **${esc(d.label)}**：${esc(d.content)}`);
    vIdx++;
  }
  lines.push('');

  const ord = ['一', '二', '三'];
  lines.push(`## ${esc(a.section2.sectionTitle)}`);
  lines.push('');
  for (const c of [...a.section2.celebrities].sort((x, y) => x.order - y.order)) {
    const label = ord[c.order - 1] ?? String(c.order);
    lines.push(`### ${c.order}. 第${label}位：${esc(c.name)}（${esc(c.angle)}）`);
    lines.push(`- 贴合实锤：${esc(c.evidence)}`);
    lines.push('');
  }
  lines.push(`#### ✅ 最适合你的名人：${esc(a.section2.bestPick.name)}`);
  lines.push('');
  lines.push(esc(a.section2.bestPick.summary));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`## ${esc(a.section3.sectionTitle)}`);
  lines.push('');
  lines.push('### 分身核心设定：');
  lines.push('');
  lines.push(esc(a.section3.personaCore));
  lines.push('');
  lines.push(`#### 【${esc(a.section3.personaName)}的完整一天】`);
  lines.push('');
  for (const row of a.section3.timeline) {
    lines.push(`${esc(row.clock)} ${esc(row.paragraph)}`);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
