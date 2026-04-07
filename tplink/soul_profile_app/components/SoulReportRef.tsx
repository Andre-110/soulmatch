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
  const similarCelebs = sortedCelebrities.slice(0, 3);
  const matchCelebs = [...sortedCelebrities].reverse().slice(0, 3);
  const finalSimilarCelebs = similarCelebs.length
    ? similarCelebs
    : [
        { name: '王菲', similarityScore: 92, recommendReason: '松弛感和表达方式接近' },
        { name: '周迅', similarityScore: 89, recommendReason: '感受力细腻，审美同频' },
        { name: '许知远', similarityScore: 85, recommendReason: '偏爱深度思考与独处' },
      ];
  const finalMatchCelebs = matchCelebs.length
    ? matchCelebs
    : [
        { name: '陈坤', similarityScore: 88, recommendReason: '情绪理解能力强，交流顺滑' },
        { name: '桂纶镁', similarityScore: 86, recommendReason: '生活节奏接近，陪伴感稳定' },
        { name: '梁朝伟', similarityScore: 84, recommendReason: '慢热但共鸣深，边界感契合' },
      ];

  const personalityRows = useMemo(() => {
    const section3 = analysisResult.article?.section3;
    return [
      `四液学说：${safeText(section3?.fourHumorTheory?.type, '待分析')}｜${safeText(section3?.fourHumorTheory?.note, '待补充')}`,
      `16型恋爱人格：${safeText(section3?.lovePersona16?.type, '待分析')}｜${safeText(section3?.lovePersona16?.note, '待补充')}`,
      `动物人格：${safeText(section3?.animalPersona?.type, '待分析')}｜${safeText(section3?.animalPersona?.note, '待补充')}`,
      `今日运势：爱情 ${safeText(section3?.todayFortune?.love, '平稳')}；事业 ${safeText(section3?.todayFortune?.career, '平稳')}；财运 ${safeText(section3?.todayFortune?.wealth, '平稳')}`,
      `五型人格：${safeText(section3?.fiveFactorPersona?.type, '待分析')}｜${safeText(section3?.fiveFactorPersona?.note, '待补充')}`,
      `水果人格：${safeText(section3?.fruitPersona?.type, '待分析')}｜${safeText(section3?.fruitPersona?.note, '待补充')}`,
      `饮品人格：${safeText(section3?.drinkPersona?.type, '待分析')}｜${safeText(section3?.drinkPersona?.note, '待补充')}`,
    ];
  }, [analysisResult.article?.section3]);

  const dayParts = useMemo(() => {
    const fromArticle = Array.isArray(analysisResult.article?.section4?.dayParts)
      ? analysisResult.article?.section4?.dayParts || []
      : [];
    const bySlot = new Map<DaySlot, (typeof fromArticle)[number]>();
    for (const part of fromArticle) {
      if (part.slot && SLOT_ORDER.includes(part.slot)) {
        bySlot.set(part.slot, part);
      }
    }
    return SLOT_ORDER.map((slot, idx) => {
      const item = bySlot.get(slot);
      const fallbackBlock = blocks[idx];
      return {
        order: idx + 1,
        slot,
        clock: safeText(item?.clock, SLOT_TIME[slot]),
        paragraph: safeText(
          item?.paragraph,
          fallbackBlock?.description
            ? fallbackBlock.description.slice(0, 120)
            : `这一段会结合你的平台数据和截图细节，生成 ${slot} 时刻的分身叙事。`,
        ),
        sourceTag: safeText(item?.sourceTag, `#${safeText(fallbackBlock?.source, '平台线索')}#`),
        detailTags: Array.isArray(item?.detailTags) && item?.detailTags.length > 0
          ? item?.detailTags
          : fallbackBlock?.tags?.slice(0, 3).map((t) => `#${t}#`) || [],
      };
    });
  }, [analysisResult.article?.section4?.dayParts, blocks]);

  const overallText = safeText(analysisResult.overall, '还在读取你的数据细节，稍后会生成更完整的首屏总结。');
  const overallLines = overallText.split('\n').map((line) => line.trim()).filter(Boolean);
  const mbtiValue = safeText(analysisResult.mbti, 'ENFP');
  const reportTag = safeText(analysisResult.title, '你的专属数字人格档案');
  const personaName = safeText(analysisResult.article?.section4?.personaName, user?.name || '你的AI分身');
  const personaCore = safeText(
    analysisResult.article?.section4?.personaCore,
    `目标是和你同频、好聊、能一起玩。当前偏好：${safeText(matchIntent, '同频搭子')}。`,
  );

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
            <div className="ref-rp-mbti-main">{mbtiValue}</div>

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
                <div className="ref-rp-ip-tag">{reportTag}</div>
                <div className="ref-rp-ip-summary">
                  {overallLines.map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="ref-rp-mbti-grid">
              {mbtiRefDimensionBars(mbtiValue).map((row, i) => (
                <div key={i} className="ref-rp-mbti-item">
                  <div className="ref-rp-mbti-label">{row.label}</div>
                  <div className="ref-rp-mbti-pct">{row.pct}%</div>
                  <div className="ref-rp-mbti-desc">{row.desc}</div>
                </div>
              ))}
            </div>

            <div className="ref-rp-personality-test">
              {personalityRows.map((line, idx) => (
                <div key={idx} className="ref-rp-test-item">{line}</div>
              ))}
            </div>

            <div className="ref-rp-celeb-wrap">
              <div className="ref-rp-celeb-group">
                <div className="ref-rp-celeb-title"><span>🌟</span> 和你最像的人</div>
                <div className="ref-rp-celeb-grid">
                  {finalSimilarCelebs.map((c, idx) => (
                    <div key={`sim-${idx}-${c.name}`} className="ref-rp-celeb-item">
                      <div className="ref-rp-celeb-av">🌟</div>
                      <div className="ref-rp-celeb-name">{c.name}</div>
                      <div className="ref-rp-celeb-desc">{Number(c.similarityScore || 0)}分｜{safeText(c.recommendReason, '同频感强')}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ref-rp-celeb-group">
                <div className="ref-rp-celeb-title"><span>💘</span> 和你最搭的人</div>
                <div className="ref-rp-celeb-grid">
                  {finalMatchCelebs.map((c, idx) => (
                    <div key={`match-${idx}-${c.name}`} className="ref-rp-celeb-item">
                      <div className="ref-rp-celeb-av">💫</div>
                      <div className="ref-rp-celeb-name">{c.name}</div>
                      <div className="ref-rp-celeb-desc">{Number(c.similarityScore || 0)}分｜{safeText(c.recommendReason, '相处轻松')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
            <p>{personaName} 的今日设定已完成同步。</p>
            <p>{personaCore}</p>
            <button type="button" className="btn btn-primary btn-glow" onClick={() => onSaveImage()}>
              保存报告图片
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
