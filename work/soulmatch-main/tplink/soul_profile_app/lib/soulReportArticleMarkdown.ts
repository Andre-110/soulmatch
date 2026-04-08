import type { SoulReport } from '@/lib/soulReportOpenAI';
import { stubArticleFromLegacy } from '@/lib/soulReportArticle';

function esc(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

function renderLegacyArticle(a: any): string {
  const lines: string[] = [];
  lines.push(`# ${esc(a.headline || '人格报告')}`);
  lines.push('');
  lines.push(esc(a.guaranteeIntro || ''));
  lines.push('');
  lines.push(`## ${esc(a.section2?.sectionTitle || '二、名人匹配')}`);
  lines.push('');
  const celebrities = Array.isArray(a.section2?.celebrities) ? a.section2.celebrities : [];
  for (const c of celebrities) {
    lines.push(`- ${esc(c.name || '—')}：${esc(c.angle || '匹配')}`);
  }
  lines.push('');
  lines.push(`## ${esc(a.section3?.sectionTitle || '三、分身的一天')}`);
  lines.push('');
  const timeline = Array.isArray(a.section3?.timeline) ? a.section3.timeline : [];
  for (const row of timeline) {
    lines.push(`- ${esc(row.clock || '--:--')} ${esc(row.paragraph || '')}`);
  }
  return lines.join('\n').trim() + '\n';
}

/** 将结构化报告转为 Markdown；新结构优先，历史结构走兼容渲染。 */
export function renderSoulReportToMarkdown(report: SoulReport): string {
  const article = report.article ?? stubArticleFromLegacy(report);
  const a: any = article;

  if (a.section1 && a.section3?.timeline) {
    return renderLegacyArticle(a);
  }

  const lines: string[] = [];
  lines.push(`# ${esc(a.headline || '人格报告')}`);
  lines.push('');
  lines.push(esc(a.guaranteeIntro || ''));
  lines.push('');
  lines.push(`## ${esc(a.section2?.sectionTitle || '二、和你灵魂高度契合的3位名人')}`);
  lines.push('');

  const celebrities = Array.isArray(a.section2?.celebrities) ? a.section2.celebrities : [];
  for (const c of celebrities.sort((x: any, y: any) => (x.order || 0) - (y.order || 0))) {
    lines.push(
      `- ${esc(c.name || '—')}｜${Number(c.similarityScore || 0)}分｜${esc(c.recommendReason || '')}`,
    );
  }
  lines.push('');
  lines.push(`## ${esc(a.section3?.sectionTitle || '三、多维人格测试')}`);
  lines.push('');
  lines.push(`- 四液学说：${esc(a.section3?.fourHumorTheory?.type || '')}｜${esc(a.section3?.fourHumorTheory?.note || '')}`);
  lines.push(`- 16型恋爱人格：${esc(a.section3?.lovePersona16?.type || '')}｜${esc(a.section3?.lovePersona16?.note || '')}`);
  lines.push(`- 动物人格：${esc(a.section3?.animalPersona?.type || '')}｜${esc(a.section3?.animalPersona?.note || '')}`);
  lines.push(`- 今日运势：爱情 ${esc(a.section3?.todayFortune?.love || '')}，事业 ${esc(a.section3?.todayFortune?.career || '')}，财运 ${esc(a.section3?.todayFortune?.wealth || '')}`);
  lines.push(`- 五型人格：${esc(a.section3?.fiveFactorPersona?.type || '')}｜${esc(a.section3?.fiveFactorPersona?.note || '')}`);
  lines.push(`- 水果人格：${esc(a.section3?.fruitPersona?.type || '')}｜${esc(a.section3?.fruitPersona?.note || '')}`);
  lines.push(`- 饮品人格：${esc(a.section3?.drinkPersona?.type || '')}｜${esc(a.section3?.drinkPersona?.note || '')}`);
  lines.push('');
  lines.push(`## ${esc(a.section4?.sectionTitle || '四、你的AI分身的一天')}`);
  lines.push('');
  lines.push(`### ${esc(a.section4?.personaName || '数字分身')}`);
  lines.push(esc(a.section4?.personaCore || ''));
  lines.push('');

  const dayParts = Array.isArray(a.section4?.dayParts) ? a.section4.dayParts : [];
  for (const part of dayParts.sort((x: any, y: any) => (x.order || 0) - (y.order || 0))) {
    lines.push(`- ${esc(part.clock || '--:--')} ${esc(part.slot || '')}`);
    lines.push(`  ${esc(part.paragraph || '')}`);
    lines.push(`  来源：${esc(part.sourceTag || '')}`);
    const tags = Array.isArray(part.detailTags) ? part.detailTags.join(' ') : '';
    if (tags) lines.push(`  标签：${esc(tags)}`);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
