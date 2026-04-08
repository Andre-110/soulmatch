'use client';

import { PrivacyNavLink } from '@/components/PrivacyNavLink';

type Highlight = {
  value: string;
  label: string;
};

type FlowItem = {
  title: string;
  desc: string;
};

type Props = {
  userName: string;
  highlights: readonly Highlight[];
  flow: readonly FlowItem[];
  onStart: () => void;
};

export function HomeStep({ userName, highlights, flow, onStart }: Props) {
  return (
    <div className="view-content view-home ref-home-screen">
      <div className="ref-home-top">
        <div className="ref-home-badge">SoulMatch Persona Studio</div>
        <div className="hero-icon-container ref-home-orbit">
          <div className="hero-icon ref-home-sparkle" aria-hidden>✦</div>
          <div className="ref-home-orbit-ring ring-one" aria-hidden />
          <div className="ref-home-orbit-ring ring-two" aria-hidden />
        </div>
        <h1 className="title ref-home-title">把公开痕迹<br />整理成你的数字分身</h1>
        <p className="ref-home-welcome">欢迎，{userName}</p>
        <p className="ref-home-lead">
          不靠空泛标签，直接用截图、公开主页和关系问卷，生成一份更像真人的灵魂档案。
        </p>
      </div>

      <div className="ref-home-stat-grid">
        {highlights.map((item) => (
          <div key={item.label} className="ref-home-stat-card">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="ref-home-cards ref-home-cards-wide">
        {flow.map((item, index) => (
          <div key={item.title} className="ref-home-card ref-home-flow-card">
            <span className="ref-home-flow-index">0{index + 1}</span>
            <h3 className="ref-home-card-h">{item.title}</h3>
            <p className="ref-home-card-p">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="ref-home-trust-card">
        <div>
          <p className="ref-home-trust-label">建档原则</p>
          <h3>只用你主动提供和公开可见的线索</h3>
        </div>
        <p>
          不读聊天记录，不碰相册全量，不要求私密账号权限。你随时可以停在任何一步。
        </p>
      </div>

      <p className="ref-home-privacy">
        不放心数据？
        <PrivacyNavLink>
          查看详细数据获取范围 &gt;
        </PrivacyNavLink>
      </p>

      <div className="bottom-action ref-home-cta">
        <button type="button" className="btn btn-primary btn-glow" onClick={onStart}>
          开始建档
        </button>
      </div>
    </div>
  );
}
