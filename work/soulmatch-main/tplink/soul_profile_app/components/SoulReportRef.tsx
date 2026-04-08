'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  MBTI_IP_IMAGE_FALLBACK,
  parsePrimaryMbtiCode,
  publicMbtiAssetUrl,
  resolveMbtiIpFromReport,
} from '@/lib/mbtiIpIndex';
import { MusicPlayer } from './MusicPlayer';
import { getRecommendedMusic } from '@/lib/musicMatcher';

const SLOT_ORDER = ['晨起', '独处', '午餐', '工作', '玩耍', '阅读'] as const;
type DaySlot = (typeof SLOT_ORDER)[number];

const SLOT_TIME: Record<DaySlot, string> = {
  晨起: '08:00',
  独处: '10:00',
  午餐: '12:30',
  工作: '14:00',
  玩耍: '18:00',
  阅读: '21:30',
};

const SLOT_BG: Record<DaySlot, string> = {
  晨起: 'linear-gradient(180deg, #1a1046 0%, #2d1b80 100%)',
  独处: 'linear-gradient(180deg, #101a46 0%, #1b3b80 100%)',
  午餐: 'linear-gradient(180deg, #2d1b80 0%, #3d2bb8 100%)',
  工作: 'linear-gradient(180deg, #3d2bb8 0%, #4d3bc8 100%)',
  玩耍: 'linear-gradient(180deg, #4d3bc8 0%, #6b48ff 100%)',
  阅读: 'linear-gradient(180deg, #6b48ff 0%, #9d6fff 100%)',
};

const SLOT_EMOJI: Record<DaySlot, string> = {
  晨起: '🌅',
  独处: '☕',
  午餐: '🍱',
  工作: '💼',
  玩耍: '🎮',
  阅读: '📚',
};

const SLOT_SCENE_VARIANTS: Record<DaySlot, string[]> = {
  晨起: ['起床'],
  独处: ['独处'],
  午餐: ['吃饭'],
  工作: ['工作'],
  玩耍: ['玩耍'],
  阅读: ['阅读', '看书'],
};

type Props = {
  analysisResult: {
    mbti?: string;
    title?: string;
    overall?: string;
    avatarTags?: string[];
    mbtiDimensions?: Array<{
      code?: string;
      label?: string;
      score?: number;
      note?: string;
    }>;
    blocks?: { source: string; icon: string; tags: string[]; title: string; description: string }[];
    mbtiIp?: { code: string; imageSrc: string; rawLabel?: string } | null;
    article?: {
      guaranteeIntro?: string;
      section2?: {
        celebrities?: Array<{
          order: number;
          name: string;
          similarityScore?: number;
          recommendReason?: string;
        }>;
      };
      section3?: {
        sectionTitle?: string;
        fourHumorTheory?: { type?: string; note?: string };
        lovePersona16?: { type?: string; note?: string };
        animalPersona?: { type?: string; note?: string };
        todayFortune?: { love?: string; career?: string; wealth?: string };
        fiveFactorPersona?: { type?: string; note?: string };
        fruitPersona?: { type?: string; note?: string };
        drinkPersona?: { type?: string; note?: string };
      };
      section4?: {
        sectionTitle?: string;
        personaName?: string;
        personaCore?: string;
        finalCard?: {
          intro?: string;
          summaryLines?: string[];
          closingLine?: string;
        };
        dayParts?: Array<{
          order?: number;
          slot?: DaySlot;
          clock?: string;
          paragraph?: string;
          sourceTag?: string;
          detailTags?: string[];
        }>;
      };
    };
  };
  user: { name: string } | null;
  userScreenshotUrls: string[];
  matchIntent?: string;
  onSaveImage: () => void;
};

function safeText(value: string | undefined | null, fallback = ''): string {
  const text = (value || '').trim();
  return text || fallback;
}

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

export function SoulReportRef({ analysisResult, user, userScreenshotUrls: _userScreenshotUrls, matchIntent, onSaveImage }: Props) {
  const mbtiIp =
    analysisResult.mbtiIp?.imageSrc != null
      ? {
          code: analysisResult.mbtiIp.code,
          imageSrc: analysisResult.mbtiIp.imageSrc,
          rawLabel: analysisResult.mbtiIp.rawLabel ?? analysisResult.mbti ?? '',
        }
      : resolveMbtiIpFromReport(analysisResult.mbti);

  const primarySrc = publicMbtiAssetUrl(mbtiIp.imageSrc);
  const fallbackSrc = publicMbtiAssetUrl(MBTI_IP_IMAGE_FALLBACK);
  const ipFallbackOnce = useRef(false);
  useEffect(() => {
    ipFallbackOnce.current = false;
  }, [primarySrc]);

  const sceneCode = parsePrimaryMbtiCode(mbtiIp.code) ?? 'INFJ';
  const recommendedMusic = getRecommendedMusic(sceneCode);
  const blocks = useMemo(
    () => (Array.isArray(analysisResult.blocks) ? analysisResult.blocks : []),
    [analysisResult.blocks],
  );
  const celebrities = Array.isArray(analysisResult.article?.section2?.celebrities)
    ? analysisResult.article?.section2?.celebrities || []
    : [];
  const sortedCelebrities = [...celebrities].sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
  const finalSimilarCelebs = sortedCelebrities.slice(0, 3);
  const avatarTagChips = Array.isArray(analysisResult.avatarTags) ? analysisResult.avatarTags.slice(0, 3) : [];
  const bestPick = finalSimilarCelebs[0] ?? null;
  const mbtiDimensionRows = useMemo(() => {
    const explicit = Array.isArray(analysisResult.mbtiDimensions)
      ? analysisResult.mbtiDimensions
        .filter((item) => item && safeText(item.label) && (typeof item.score === 'number' || safeText(item.note)))
        .slice(0, 4)
        .map((item) => ({
          label: safeText(item.label),
          score: typeof item.score === 'number' ? Math.max(0, Math.min(100, Math.round(item.score))) : null,
          note: safeText(item.note),
        }))
      : [];
    if (explicit.length > 0) return explicit;
    const mbti = safeText(analysisResult.mbti).toUpperCase().replace(/[^A-Z]/g, '');
    const pairs = [
      { left: 'I', right: 'E', leftLabel: 'I 内向', rightLabel: 'E 外向' },
      { left: 'N', right: 'S', leftLabel: 'N 直觉', rightLabel: 'S 实感' },
      { left: 'F', right: 'T', leftLabel: 'F 感性', rightLabel: 'T 理性' },
      { left: 'P', right: 'J', leftLabel: 'P 随性', rightLabel: 'J 计划' },
    ];
    return pairs.map((pair, index) => {
      const letter = mbti[index];
      return {
        label: letter === pair.left ? pair.leftLabel : pair.rightLabel,
        score: null,
        note: '',
      };
    }).filter((row) => row.label);
  }, [analysisResult.mbti, analysisResult.mbtiDimensions]);

  const personalityRows = useMemo(() => {
    const section3 = analysisResult.article?.section3;
    const rows = [
      section3?.fourHumorTheory?.type && section3?.fourHumorTheory?.note
        ? `四液学说：${section3.fourHumorTheory.type}｜${section3.fourHumorTheory.note}`
        : null,
      section3?.lovePersona16?.type && section3?.lovePersona16?.note
        ? `16型恋爱人格：${section3.lovePersona16.type}｜${section3.lovePersona16.note}`
        : null,
      section3?.animalPersona?.type && section3?.animalPersona?.note
        ? `动物人格：${section3.animalPersona.type}｜${section3.animalPersona.note}`
        : null,
      section3?.todayFortune?.love && section3?.todayFortune?.career && section3?.todayFortune?.wealth
        ? `今日运势：爱情 ${section3.todayFortune.love}；事业 ${section3.todayFortune.career}；财运 ${section3.todayFortune.wealth}`
        : null,
      section3?.fiveFactorPersona?.type && section3?.fiveFactorPersona?.note
        ? `五型人格：${section3.fiveFactorPersona.type}｜${section3.fiveFactorPersona.note}`
        : null,
      section3?.fruitPersona?.type && section3?.fruitPersona?.note
        ? `水果人格：${section3.fruitPersona.type}｜${section3.fruitPersona.note}`
        : null,
      section3?.drinkPersona?.type && section3?.drinkPersona?.note
        ? `饮品人格：${section3.drinkPersona.type}｜${section3.drinkPersona.note}`
        : null,
    ];
    return rows.filter((row): row is string => Boolean(row));
  }, [analysisResult.article?.section3]);

  const dayParts = useMemo(() => {
    const fromArticle = Array.isArray(analysisResult.article?.section4?.dayParts)
      ? analysisResult.article?.section4?.dayParts || []
      : [];
    return fromArticle
      .filter((part): part is NonNullable<typeof fromArticle[number]> & { slot: DaySlot; clock: string; paragraph: string; sourceTag: string; detailTags?: string[] } =>
        Boolean(part?.slot && SLOT_ORDER.includes(part.slot) && part.clock && part.paragraph && part.sourceTag),
      )
      .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
      .map((part) => ({
        order: part.order ?? SLOT_ORDER.indexOf(part.slot) + 1,
        slot: part.slot,
        clock: part.clock,
        paragraph: part.paragraph,
        sourceTag: part.sourceTag,
        detailTags: Array.isArray(part.detailTags) ? part.detailTags : [],
      }));
  }, [analysisResult.article?.section4?.dayParts]);

  const overallText = safeText(analysisResult.overall);
  const overallLines = overallText.split('\n').map((line) => line.trim()).filter(Boolean);
  const mbtiValue = safeText(analysisResult.mbti);
  const reportTag = safeText(analysisResult.title);
  const personaName = safeText(analysisResult.article?.section4?.personaName);
  const personaCore = safeText(analysisResult.article?.section4?.personaCore);
  const finalCardIntro = safeText(analysisResult.article?.section4?.finalCard?.intro);
  const finalCardSummaryLines = Array.isArray(analysisResult.article?.section4?.finalCard?.summaryLines)
    ? uniq(
      (analysisResult.article?.section4?.finalCard?.summaryLines || [])
        .map((line) => safeText(line))
        .filter(Boolean),
    ).slice(0, 4)
    : [];
  const finalCardClosingLine = safeText(analysisResult.article?.section4?.finalCard?.closingLine);

  const buildSceneCandidates = (slot: DaySlot) => {
    const variants = SLOT_SCENE_VARIANTS[slot];
    return variants.map((v) => publicMbtiAssetUrl(`/mbti-scene-assets/${sceneCode}/${sceneCode}_${v}.png`));
  };

  return (
    <div className="soul-report-ref-root">
      <MusicPlayer musicUrl={recommendedMusic.url} title={recommendedMusic.name} />
      <p className="ref-rp-hint-top">向下滑动 · 查看完整档案</p>

      <div id="soul-poster-capture" className="ref-rp-capture">
        <section className="ref-rp-section ref-rp-s1" style={{ background: 'linear-gradient(135deg, #6b48ff 0%, #9d6fff 100%)' }}>
          <div className="ref-rp-s1-inner">
            <h2 className="ref-rp-h2-main">你的专属人格报告</h2>
            {mbtiValue ? <div className="ref-rp-mbti-main">{mbtiValue}</div> : null}

            <div className="ref-rp-ip-row">
              <div className="ref-rp-ip-avatar ref-rp-ip-avatar-mbti">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={primarySrc}
                    alt={`${mbtiIp.code} 专属 IP 形象`}
                    title={`${mbtiIp.code}${mbtiIp.rawLabel && mbtiIp.rawLabel !== mbtiIp.code ? ` · ${mbtiIp.rawLabel}` : ''}`}
                    loading="eager"
                    fetchPriority="high"
                    onError={(e) => {
                      if (ipFallbackOnce.current) return;
                      ipFallbackOnce.current = true;
                      e.currentTarget.src = fallbackSrc;
                    }}
                  />
              </div>
              <div className="ref-rp-ip-info">
                {reportTag ? <div className="ref-rp-ip-tag">{reportTag}</div> : null}
                {avatarTagChips.length > 0 ? (
                  <div className="ref-rp-tag-row">
                    {avatarTagChips.map((tag) => (
                      <span key={tag} className="ref-rp-tag-chip">{tag}</span>
                    ))}
                  </div>
                ) : null}
                <div className="ref-rp-ip-summary">
                  {overallLines.length > 0 ? overallLines.map((line, idx) => (
                    <p key={idx}>{line}</p>
                  )) : <p>AI 尚未返回首屏总结。</p>}
                </div>
              </div>
            </div>

            <div className="ref-rp-mbti-grid">
              {mbtiDimensionRows.map((row, i) => (
                <div key={i} className="ref-rp-mbti-item">
                  <div className="ref-rp-mbti-label">{row.label}</div>
                  {typeof row.score === 'number' ? <div className="ref-rp-mbti-pct">{row.score}%</div> : null}
                  {row.note ? <div className="ref-rp-mbti-desc">{row.note}</div> : null}
                </div>
              ))}
            </div>

            {personalityRows.length > 0 ? (
              <div className="ref-rp-personality-test">
                {personalityRows.map((line, idx) => (
                  <div key={idx} className="ref-rp-test-item">{line}</div>
                ))}
              </div>
            ) : null}

            {finalSimilarCelebs.length > 0 ? (
              <>
                <div className="ref-rp-celeb-wrap">
                  <div className="ref-rp-celeb-group">
                    <div className="ref-rp-celeb-title"><span>🌟</span> 和你最像的人</div>
                    <div className="ref-rp-celeb-grid">
                      {finalSimilarCelebs.map((c, idx) => (
                        <div key={`sim-${idx}-${c.name}`} className="ref-rp-celeb-item">
                          <div className="ref-rp-celeb-av">🌟</div>
                          <div className="ref-rp-celeb-name">{c.name}</div>
                          <div className="ref-rp-celeb-desc">{Number(c.similarityScore || 0)}分｜{safeText(c.recommendReason)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {bestPick ? (
                  <div className="ref-rp-best-pick">
                    最佳同频：{bestPick.name}（{Number(bestPick.similarityScore || 0)}分）· {safeText(bestPick.recommendReason)}
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="ref-rp-bounce-tip">👇 下滑查看 AI 分身完整的一天</div>
          </div>
        </section>

        {dayParts.map((part) => {
          const sceneCandidates = buildSceneCandidates(part.slot);
          return (
            <section key={part.slot} className="ref-rp-section ref-rp-day-section" style={{ background: SLOT_BG[part.slot] }}>
              <div className="ref-rp-day-card">
                <div className="ref-rp-day-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sceneCandidates[0] || primarySrc}
                    alt={`${mbtiIp.code} ${part.slot} 场景`}
                    onError={(e) => {
                      const img = e.currentTarget;
                      const nextIndex = Number(img.dataset.sceneCandidateIndex || '0') + 1;
                      if (nextIndex < sceneCandidates.length) {
                        img.dataset.sceneCandidateIndex = String(nextIndex);
                        img.src = sceneCandidates[nextIndex];
                        return;
                      }
                      img.src = primarySrc;
                    }}
                  />
                </div>
                <div className="ref-rp-day-title">{SLOT_EMOJI[part.slot]} {part.clock} {part.slot}时刻</div>
                <div className="ref-rp-day-desc">{part.paragraph}</div>
                <div className="ref-rp-day-source">数据来源：{part.sourceTag}</div>
                {part.detailTags.length > 0 ? (
                  <div className="ref-rp-day-tags">{part.detailTags.join(' ')}</div>
                ) : null}
              </div>
            </section>
          );
        })}

        <section className="ref-rp-section ref-rp-final">
          <div className="ref-rp-final-card">
            <h3>报告生成完成</h3>
            {finalCardIntro ? <p>{finalCardIntro}</p> : personaName ? <p>{personaName} 的今日设定已完成同步。</p> : null}
            {personaCore ? <p>{personaCore}</p> : null}
            {finalCardSummaryLines.length > 0 ? (
              <div className="ref-rp-final-summary">
                {finalCardSummaryLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
            {finalCardClosingLine ? <p>{finalCardClosingLine}</p> : null}
            <button type="button" className="btn btn-primary btn-glow" onClick={() => onSaveImage()}>
              保存报告图片
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
