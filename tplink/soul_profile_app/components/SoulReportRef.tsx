'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getMbtiSceneAssetCandidates,
  MBTI_IP_IMAGE_FALLBACK,
  parsePrimaryMbtiCode,
  publicMbtiAssetUrl,
  resolveMbtiIpFromReport,
} from '@/lib/mbtiIpIndex';
import { MusicPlayer } from './MusicPlayer';
import { getRecommendedMusic } from '@/lib/musicMatcher';

/** 四幕场景优先使用 MBTI 专属场景图，缺图时回退到顶部 IP 形象。 */
const REF_SCENE_PRESETS = [
  {
    assetKey: '起床',
    tagline: '生活的美好，藏在每一个重复的小习惯里',
    time: '🌤️ 08:00 · 晨起时刻',
    gradient: 'linear-gradient(180deg, #1a1046 0%, #2d1b80 100%)',
    orb: 'radial-gradient(circle, rgba(107,72,255,0.35) 0%, rgba(107,72,255,0) 70%)',
    orbRight: true,
  },
  {
    assetKey: '阅读',
    tagline: '沉浸在热爱里，时间会悄悄发光',
    time: '📖 10:30 · 品茶读书',
    gradient: 'linear-gradient(180deg, #101a46 0%, #1b3b80 100%)',
    orb: 'radial-gradient(circle, rgba(72,155,255,0.35) 0%, rgba(72,155,255,0) 70%)',
    orbRight: false,
  },
  {
    assetKey: '吃饭',
    tagline: '干饭不积极，思想有问题',
    time: '🍚 12:00 · 午餐时刻',
    gradient: 'linear-gradient(180deg, #461028 0%, #801b45 100%)',
    orb: 'radial-gradient(circle, rgba(255,120,117,0.35) 0%, rgba(255,120,117,0) 70%)',
    orbRight: true,
  },
  {
    assetKey: '独处',
    tagline: '慢下来的时光，才是生活本身',
    time: '🌙 20:00 · 晚间放松',
    gradient: 'linear-gradient(180deg, #104638 0%, #1b8065 100%)',
    orb: 'radial-gradient(circle, rgba(107,221,255,0.35) 0%, rgba(107,221,255,0) 70%)',
    orbRight: false,
  },
] as const;

// 硬编码的名人数据已移除，现在使用 LLM 生成的数据
// 如果 LLM 未生成数据，会在组件内使用占位数据

function mbtiRefDimensionBars(mbti: string): { label: string; pct: number; desc: string }[] {
  // 用 parsePrimaryMbtiCode 处理融合型（如 ENTP×INTP）
  const primary = parsePrimaryMbtiCode(mbti);
  const s = (primary ?? '').toUpperCase();
  if (s.length !== 4 || !/^[EI][NS][FT][JP]$/.test(s)) {
    return [
      { label: 'E/I', pct: 50, desc: '待完善' },
      { label: 'N/S', pct: 50, desc: '待完善' },
      { label: 'F/T', pct: 50, desc: '待完善' },
      { label: 'P/J', pct: 50, desc: '待完善' },
    ];
  }
  const [e, n, f, p] = s.split('');
  const pct = (i: number) => 62 + ((s.charCodeAt(0) + i * 17) % 28);
  return [
    e === 'E'
      ? { label: 'E/外向', pct: pct(0), desc: '选择性外向' }
      : { label: 'I/内向', pct: pct(0), desc: '内向为主' },
    n === 'N'
      ? { label: 'N/直觉', pct: pct(1), desc: '浪漫感知者' }
      : { label: 'S/实感', pct: pct(1), desc: '脚踏实地' },
    f === 'F'
      ? { label: 'F/感性', pct: pct(2), desc: '情绪捕手' }
      : { label: 'T/思考', pct: pct(2), desc: '理性分析' },
    p === 'P'
      ? { label: 'P/随性', pct: pct(3), desc: '佛系玩家' }
      : { label: 'J/判断', pct: pct(3), desc: '计划井然' },
  ];
}

type Props = {
  analysisResult: {
    mbti?: string;
    title?: string;
    overall?: string;
    avatarTags?: string[];
    blocks?: { source: string; icon: string; tags: string[]; title: string; description: string }[];
    /** 服务端根据 report.mbti 解析；缺省时组件内再算 */
    mbtiIp?: { code: string; imageSrc: string; rawLabel?: string } | null;
    /** 长文档案（包含 LLM 生成的名人数据） */
    article?: {
      /** 与 `overall` 可能不同；用于深度区导语，避免与首屏重复同一段 */
      guaranteeIntro?: string;
      section2?: {
        celebrities?: Array<{
          order: number;
          name: string;
          angle: string;
          evidence: string;
        }>;
        bestPick?: { name: string; summary: string };
      };
    };
  };
  user: { name: string } | null;
  userScreenshotUrls: string[];
  onSaveImage: () => void;
};

export function SoulReportRef({ analysisResult, user, userScreenshotUrls, onSaveImage }: Props) {
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
  const [ipSrc, setIpSrc] = useState(primarySrc);
  const ipFallbackOnce = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIpSrc(primarySrc);
    ipFallbackOnce.current = false;
  }, [primarySrc]);

  const sceneImageCandidates = REF_SCENE_PRESETS.map((scene) =>
    getMbtiSceneAssetCandidates(mbtiIp.code, scene.assetKey).map(publicMbtiAssetUrl),
  );

  const blocks = Array.isArray(analysisResult.blocks) ? analysisResult.blocks : [];
  const tags = Array.isArray(analysisResult.avatarTags) ? analysisResult.avatarTags : [];
  const checklist = [...tags.slice(0, 3)];
  while (checklist.length < 3) checklist.push('更多气质线索见档案叙事');

  // 根据 MBTI 匹配音乐
  const recommendedMusic = getRecommendedMusic(mbtiIp.code);

  // 获取 LLM 生成的名人数据
  const llmCelebrities = analysisResult.article?.section2?.celebrities || [];
  // 检测是否为 stub（名字包含"待模型生成"或为空）
  const isRealCelebrity = (c: { name: string }) =>
    c.name.trim().length > 0 && !c.name.includes('待模型生成') && !c.name.includes('—');
  const hasLlmCelebrities = llmCelebrities.length === 3 && llmCelebrities.every(isRealCelebrity);

  const platformCount = Math.max(1, Math.min(6, blocks.length));
  const homePageCount = blocks.length > 0 ? blocks.length : platformCount;
  const digitalTwinTitle = user?.name?.trim()
    ? `${user.name.trim()}的数字映像`
    : '数字橙汁';
  const overallTrim = analysisResult.overall?.trim() ?? '';
  const guaranteeTrim = analysisResult.article?.guaranteeIntro?.trim() ?? '';
  const isStubIntro = (s: string) =>
    s.includes('离线') || s.includes('兜底生成') || s.includes('OPENAI_API_KEY');

  /** 检测并替换平台登录页/无效抓取文字 */
  const cleanPlatformDesc = (desc: string, fallback: string): string => {
    if (!desc || desc.length === 0) return fallback;
    const looksLikeLoginPage =
      /沪ICP|行吟信息科技|创作中心.*业务合作.*发现.*直播.*发布.*通知.*登录|你的浏览器似乎开启了广告屏蔽/.test(desc);
    if (looksLikeLoginPage) return fallback;
    return desc;
  };
  const deepIntro =
    guaranteeTrim && guaranteeTrim !== overallTrim && !isStubIntro(guaranteeTrim)
      ? guaranteeTrim
      : `以下按「核心人格 → 兴趣 → 表达 → 生活节奏」展开，逐条对应你已绑定平台的主页摘录。`;

  const sectionConfigs = [
    { title: '核心人格', icon: '🧠', subtitle: '人格底色 · 价值观', fallback: '继续提供素材，我们会为你精确拆解人格核心。' },
    { title: '兴趣爱好', icon: '🎯', subtitle: '热爱与流量', fallback: '更多平台素材可解锁你最在意的兴趣标签。' },
    { title: '说话风格 · 三观', icon: '💬', subtitle: '语气 / 立场', fallback: '连结更多内容可让AI把你的语调与立场描摹得更真。' },
    { title: '生活节奏', icon: '🌿', subtitle: '日常节奏', fallback: '继续上传照片与故事，描绘你真实的仪式感。' },
  ];

  const deepSections = sectionConfigs.map((config, idx) => {
    const block = blocks[idx];
    const rawDesc = block?.description ?? '';
    const cleanedDesc = cleanPlatformDesc(rawDesc, config.fallback);
    const summary = cleanedDesc.length > 0
      ? (cleanedDesc.length > 140 ? `${cleanedDesc.slice(0, 140)}…` : cleanedDesc)
      : config.fallback;
    const highlightTags = block?.tags?.slice(0, 3).map((tag) => `#${tag}`);
    const highlights = [
      block?.title,
      highlightTags?.length ? highlightTags.join(' · ') : undefined,
      block?.source,
    ].filter(Boolean);
    return {
      ...config,
      summary,
      highlights: highlights.length
        ? highlights
        : ['继续提供素材即可解锁更多细节'],
    };
  });

  const musicLabel = recommendedMusic.name || '你的专属歌单';
  const mainTag = tags[0] ?? '天然温柔';
  const secondTag = tags[1] ?? '理性踏实';
  const thirdTag = tags[2] ?? '松弛有界';
  const digitalMoments = [
    {
      time: '07:30 · 晨起',
      text: `自然醒后放一首《${musicLabel}》，让 ${mainTag} 的节奏柔化早晨，先从不卷的人生开始。`,
    },
    {
      time: '11:00 · 内容 / 工作',
      text: `${analysisResult.title ?? '在数字空间写实质故事'} 的节奏感，让 ${secondTag} 的行动与创意协调，任务有序而不压迫。`,
    },
    {
      time: '18:30 · 烟火生活',
      text: `日常中渗透着 ${checklist[0] ?? '温柔守护'}，享受食物、交谈与安静的边界，碾压掉所有焦虑。`,
    },
    {
      time: '22:30 · 静心',
      text: `放下手机、盘腿坐下，用 ${thirdTag} 的态度重启自己，给身体与情绪一个软着陆。`,
    },
  ];

  return (
    <div className="soul-report-ref-root">
      <MusicPlayer musicUrl={recommendedMusic.url} title={recommendedMusic.name} />
      <p className="ref-rp-hint-top">向下滑动 · 查看完整档案</p>
      <p className="ref-rp-build-badge" aria-hidden>
        SoulMatch 报告 · 全页统一 MBTI IP
      </p>

      <div id="soul-poster-capture" className="ref-rp-capture">
        {/* 第一屏：专属报告 + MBTI IP + 维度条 + 名人 */}
        <section
          className="ref-rp-section ref-rp-s1"
          style={{ background: 'linear-gradient(135deg, #6b48ff 0%, #9d6fff 100%)' }}
        >
          <div className="ref-rp-s1-inner">
            <h2 className="ref-rp-h2-main">你的专属人格报告</h2>

            <div className="ref-rp-ip-row">
              <div className="ref-rp-ip-avatar ref-rp-ip-avatar-mbti">
                <img
                  src={ipSrc}
                  alt={`${mbtiIp.code} 专属 IP 形象`}
                  title={`${mbtiIp.code}${mbtiIp.rawLabel && mbtiIp.rawLabel !== mbtiIp.code ? ` · ${mbtiIp.rawLabel}` : ''}`}
                  loading="eager"
                  fetchPriority="high"
                  onError={() => {
                    if (ipFallbackOnce.current) return;
                    ipFallbackOnce.current = true;
                    if (ipSrc !== fallbackSrc) {
                      // 先切换到 INFJ 兜底图
                      setIpSrc(fallbackSrc);
                    } else {
                      // primary === fallback（如本身就是 INFJ），用时间戳强制重试
                      const base = fallbackSrc.split('?')[0];
                      setIpSrc(`${base}?retry=${Date.now()}`);
                    }
                  }}
                />
              </div>
              <div className="ref-rp-ip-info">
                <div className="ref-rp-ip-mbti-badge" aria-hidden>
                  你的 MBTI 专属 IP · <strong>{mbtiIp.code}</strong>
                </div>
                <div className="ref-rp-ip-tag">{analysisResult.title}</div>
                {user?.name ? <div className="ref-rp-user-name">{user.name}</div> : null}
                {analysisResult.overall ? (
                  <div className="ref-rp-ip-summary">
                    {analysisResult.overall.split('\n').map((line: string, i: number) => (
                      <p key={i}>{line || '\u00A0'}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="ref-rp-mbti-grid">
              {mbtiRefDimensionBars(String(analysisResult.mbti ?? '')).map((row, i) => (
                <div key={i} className="ref-rp-mbti-item">
                  <div className="ref-rp-mbti-label">{row.label}</div>
                  <div className="ref-rp-mbti-pct">{row.pct}%</div>
                  <div className="ref-rp-mbti-desc">{row.desc}</div>
                </div>
              ))}
            </div>

            <div className="ref-rp-celeb-wrap">
              <div className="ref-rp-celeb-group">
                <div className="ref-rp-celeb-title">
                  <span>🌟</span> 和你灵魂高度契合的名人
                </div>
                {hasLlmCelebrities ? (
                  <div className="ref-rp-celeb-grid">
                    {llmCelebrities.map((c, idx) => (
                      <div key={c.order || idx} className="ref-rp-celeb-item">
                        <div className="ref-rp-celeb-av" style={{ background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                          🌟
                        </div>
                        <div className="ref-rp-celeb-name">{c.name}</div>
                        <div className="ref-rp-celeb-desc">{c.angle}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '6px', lineHeight: '1.4' }}>
                          {c.evidence.slice(0, 80)}{c.evidence.length > 80 ? '…' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '18px 8px', color: 'rgba(255,255,255,0.75)', fontSize: '14px', lineHeight: '1.8' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>✨</div>
                    <div>完成在线分析后，AI 将为你</div>
                    <div>精准匹配 <strong style={{ color: '#ffd1ff' }}>3 位</strong> 气质高度相近的名人</div>
                  </div>
                )}
              </div>
            </div>

            <div className="ref-rp-bounce-tip">恭喜你的 AI 分身已创建，下滑查看它的一天吧！ 👇</div>
          </div>
        </section>

        <section className="ref-rp-section ref-rp-deep-section">
          <div className="ref-rp-deep-inner">
            <p className="ref-rp-deep-kicker">
              你的全网人格全维度精准解码（100% 来自你 {homePageCount} 个主页的实锤细节）
            </p>
            <h3 className="ref-rp-deep-heading">一、全维度细节拆解</h3>
            <p className="ref-rp-deep-subtitle">{deepIntro}</p>
            <div className="ref-rp-deep-grid">
              {deepSections.map((section) => (
                <article key={section.title} className="ref-rp-deep-card">
                  <div className="ref-rp-deep-card-icon">{section.icon}</div>
                  <div className="ref-rp-deep-card-title">
                    <h4>{section.title}</h4>
                    <span>{section.subtitle}</span>
                  </div>
                  <p>{section.summary}</p>
                  <ul>
                    {section.highlights.map((highlight, idx) => (
                      <li key={`${section.title}-${idx}`}>{highlight}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ref-rp-section ref-rp-digital-day">
          <div className="ref-rp-deep-inner">
            <p className="ref-rp-digital-heading">二、你的 AI 分身「{digitalTwinTitle}」的一天</p>
            <p className="ref-rp-digital-sub">
              100% 复刻你的节奏，给你允许放慢的许可证、清晰的三观与隐私边界。
            </p>
            <div className="ref-rp-digital-grid">
              {digitalMoments.map((moment) => (
                <article key={moment.time} className="ref-rp-digital-moment">
                  <p className="ref-rp-digital-time">{moment.time}</p>
                  <p className="ref-rp-digital-text">{moment.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 四幕全屏：每幕对应 blocks[i]，如果 block 不足则使用默认内容 */}
        {REF_SCENE_PRESETS.map((scene, idx) => {
          const b = blocks[idx] || {
            title: '探索你的数字足迹',
            description: '通过分析你的社交平台、音乐品味、阅读偏好等多维度数据，AI 正在为你构建专属的数字分身。绑定更多平台，让分身更了解你。',
            source: '多平台数据分析',
            tags: [] as string[],
          };
          const tagLine =
            b.tags.length > 0 ? b.tags.slice(0, 4).map((t) => `#${t}`).join(' · ') : null;
          return (
            <section
              key={idx}
              className="ref-rp-section ref-rp-scene"
              style={{ background: scene.gradient, color: '#fff' }}
            >
              <div
                className="ref-rp-orb"
                style={{
                  background: scene.orb,
                  ...(scene.orbRight ? { right: '8%', left: 'auto' } : { left: '8%', right: 'auto' }),
                }}
              />
              <div className="ref-rp-scene-content">
                <p className="ref-rp-scene-tagline">{scene.tagline}</p>
                <p className="ref-rp-scene-time">{scene.time}</p>
                <p className="ref-rp-scene-co">你的 AI 分身 · 坐标数字空间</p>
                <p className="ref-rp-scene-h1">{b.title}</p>
                {tagLine ? <p className="ref-rp-scene-body">{tagLine}</p> : null}
                {(() => {
                  const sceneDesc = cleanPlatformDesc(b.description, '');
                  return sceneDesc.length > 20 ? (
                    <p className="ref-rp-scene-body" style={{ fontSize: '15px', lineHeight: '1.7', opacity: 0.9 }}>
                      {sceneDesc.length > 120 ? `${sceneDesc.slice(0, 120)}…` : sceneDesc}
                    </p>
                  ) : null;
                })()}
                <p className="ref-rp-scene-src">来源：{b.source}</p>
                <div className="ref-rp-scene-img">
                  <img
                    key={`scene-${mbtiIp.code}-${idx}`}
                    src={sceneImageCandidates[idx]?.[0] ?? ipSrc}
                    alt={`${mbtiIp.code} ${scene.assetKey}场景图`}
                    onError={(e) => {
                      const img = e.currentTarget;
                      const candidates = sceneImageCandidates[idx] ?? [];
                      const nextIndex = Number(img.dataset.sceneCandidateIndex ?? '0') + 1;
                      if (nextIndex < candidates.length) {
                        img.dataset.sceneCandidateIndex = String(nextIndex);
                        img.src = candidates[nextIndex];
                        return;
                      }
                      if (img.dataset.sceneFallbackApplied === '1') return;
                      img.dataset.sceneFallbackApplied = '1';
                      img.src = ipSrc;
                    }}
                  />
                </div>
              </div>
            </section>
          );
        })}

        {blocks.length > 4 && (
          <section
            className="ref-rp-section ref-rp-more"
            style={{ background: 'linear-gradient(180deg, #2d1b4a 0%, #3A1C59 100%)' }}
          >
            <h3 className="ref-rp-more-title">更多线索解读</h3>
            <div className="ref-rp-more-list">
              {blocks.slice(4).map((b, i) => {
                const displayDesc = cleanPlatformDesc(
                  b.description,
                  '该平台需要登录后才能查看完整主页，截图数据已作为视觉线索纳入分析。',
                );
                return (
                  <div key={i} className="ref-rp-more-card">
                    <div className="ref-rp-more-meta">
                      {b.icon} {b.source}
                    </div>
                    <div className="ref-rp-more-h">{b.title}</div>
                    <p className="ref-rp-more-p">{displayDesc}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 生活瞬间：白卡 + 真图（对齐 ref） */}
        {userScreenshotUrls.length > 0 && (
          <section
            className="ref-rp-section ref-rp-moments-outer"
            style={{ background: 'linear-gradient(135deg, #6b48ff 0%, #9d6fff 100%)' }}
          >
            <div className="ref-rp-moments-inner">
              <h2 className="ref-rp-moments-h2">🌟 你的生活瞬间</h2>
              <div className="ref-rp-white-card">
                <div className="ref-rp-card-title">
                  <span>📸</span> 从照片读懂你
                </div>
                <p className="ref-rp-card-intro">分析你的日常照片和朋友圈，发现你是：</p>
                <ul className="ref-rp-card-ul">
                  {checklist.map((t, i) => (
                    <li key={i}>✅ 灵魂侧写：{t}</li>
                  ))}
                </ul>
                <div className="ref-rp-photo-grid">
                  {userScreenshotUrls.map((url) => (
                    <img key={url} className="ref-rp-photo-img" src={url} alt="" />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 打分 + 匹配（对齐 ref） */}
        <section
          className="ref-rp-section ref-rp-vip"
          style={{ background: 'linear-gradient(135deg, #6b48ff 0%, #9d6fff 100%)' }}
        >
          <h2 className="ref-rp-vip-h2">💖 为你的报告打分</h2>
          <p className="ref-rp-vip-sub">分享报告即可领取 1 个月 VIP 会员，匹配 3 个同频搭子～</p>
          <div className="ref-rp-stars-row">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="ref-rp-star-btn">
                ⭐
              </span>
            ))}
          </div>
          <button type="button" className="ref-rp-share-btn" onClick={() => onSaveImage()}>
            分享报告领会员
          </button>
          <div className="ref-rp-match-card">
            <p className="ref-rp-match-t">
              已为你匹配到 <strong>3 位</strong> 同频搭子 ✨
              <br />
              点击下方按钮立即查看 →
            </p>
            <button
              type="button"
              className="ref-rp-match-btn"
              onClick={() => {
                document.querySelector('#app .view-container')?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              查看匹配搭子
            </button>
          </div>
        </section>

        <div className="qr-share-section inline ref-rp-qr">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://soulmatch.app&color=3A1C59&bgcolor=ffffff"
            className="qr-code glossy"
            alt=""
          />
          <div className="qr-text">
            灵魂档案已就绪
            <br />
            <span className="qr-sub">可截屏分享给朋友</span>
          </div>
        </div>
      </div>

      <div className="bottom-action floating-actions">
        <button type="button" className="btn btn-primary btn-glow" onClick={() => onSaveImage()}>
          ↓ 保存灵魂档案图片
        </button>
      </div>
    </div>
  );
}
