'use client';

import { useState } from 'react';
import { resolvePlatformUrl, type PlatformKey } from '@/lib/platformUrls';

const PLATFORM_EXAMPLES: Record<PlatformKey, string> = {
  weibo:   'https://weibo.com/u/你的数字ID  或直接填数字ID',
  xhs:     'https://xhslink.com/m/…（App 内「分享 → 复制链接」得到的短链）',
  douyin:  'https://www.douyin.com/user/MS4wLjAB…（完整主页链接）',
  netease: 'https://music.163.com/user/home?id=你的数字ID  或直接填数字ID',
  douban:  'https://www.douban.com/people/你的ID/  或直接填ID',
  zhihu:   'https://www.zhihu.com/people/你的用户名  或直接填用户名',
};

type PlatformHint = {
  text: string;
  link?: { label: string; href: string };
};

const PLATFORM_HINTS: Record<PlatformKey, PlatformHint[]> = {
  weibo:   [
    { text: '打开微博网页版', link: { label: '官网入口', href: 'https://weibo.com' } },
    { text: '点击右上角头像 → 进入你的个人主页' },
    { text: '复制地址栏链接（形如 weibo.com/u/数字ID），粘贴到输入框' },
  ],
  xhs:     [
    { text: '打开小红书 App，点底部「我」→ 右上角「···」→「分享」→「复制链接」' },
    { text: '粘贴以 https://xhslink.com/m/ 开头的链接（网页版主页 URL 无法访问，必须用 App 分享链接）' },
  ],
  douyin:  [
    { text: '方法 A（App）：点底部「我」→ 右上角三横 → 分享 → 复制链接', link: { label: '抖音 App', href: 'https://www.douyin.com' } },
    { text: '方法 B（网页）：打开抖音官网', link: { label: '官网入口', href: 'https://www.douyin.com' } },
    { text: '进入你的主页，复制地址栏完整链接，粘贴到输入框（系统会自动识别）' },
  ],
  netease: [
    { text: '打开网易云音乐网页版', link: { label: '官网入口', href: 'https://music.163.com' } },
    { text: '点击右上角头像 → 进入你的个人主页' },
    { text: '复制地址栏链接（形如 music.163.com/user/home?id=数字ID），粘贴到输入框' },
  ],
  douban:  [
    { text: '打开豆瓣网页版', link: { label: '官网入口', href: 'https://www.douban.com' } },
    { text: '点击右上角头像 → 进入你的个人主页' },
    { text: '复制地址栏链接（形如 douban.com/people/你的ID/），粘贴到输入框' },
  ],
  zhihu:   [
    { text: '打开知乎网页版', link: { label: '官网入口', href: 'https://www.zhihu.com' } },
    { text: '点击右上角头像 → 进入你的个人主页' },
    { text: '复制地址栏链接（形如 zhihu.com/people/你的用户名），粘贴到输入框' },
  ],
};

type ValidationResult = { ok: true; msg: string; url: string } | { ok: false; msg: string };

type Props = {
  id: PlatformKey;
  name: string;
  iconStr: string;
  bg: string;
  color: string;
  savedUrl?: string;
  onBind: (id: PlatformKey, url: string) => void;
  onCopy: (text: string, successMsg: string) => void;
  onShowTutorial: (id: PlatformKey) => void;
};

export function PlatformBinder({ id, name, iconStr, bg, color, savedUrl, onBind, onCopy, onShowTutorial }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [validation, setValidation] = useState<ValidationResult | undefined>();

  const isBound = !!savedUrl && !isActive;

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (val.trim()) {
      const r = resolvePlatformUrl(id, val);
      if (r.ok) {
        setValidation({ ok: true, msg: '✓ 解析成功：', url: r.url });
      } else {
        const errMsg = (r as { ok: false; error: string }).error;
        setValidation({ ok: false, msg: `✗ ${errMsg}` });
      }
    } else {
      setValidation(undefined);
    }
  };

  const handleBind = () => {
    if (validation?.ok) {
      onBind(id, validation.url);
      setIsActive(false);
      setInputValue('');
      setValidation(undefined);
    }
  };

  return (
    <div className="platform-row-wrapper" key={id}>
      <div className={`platform-item ${isBound ? 'connected' : ''}`} onClick={() => setIsActive(!isActive)}>
        <div className="p-icon" style={{ background: bg, color: color }}>{iconStr}</div>
        <div className="p-info">{name}</div>
        <div className="p-status">{isBound ? '已绑定' : '未绑定'}</div>
      </div>

      {savedUrl && (
        <p className="platform-hint">
          主页链接：<a href={savedUrl} target="_blank" rel="noopener noreferrer" className="platform-link">{savedUrl}</a>
        </p>
      )}

      {isActive && (
        <div className="tutorial-container">
          <p className="tutorial-title">
            📋 如何获取你自己的链接
          </p>

          <div className="tutorial-hints-list">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="tutorial-step">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/tutorials/${id}-step${stepNum}.png`}
                  alt={`${name}获取链接教程步骤${stepNum}`}
                  style={{ width: '100%', display: 'block' }}
                  onError={(e) => {
                    e.currentTarget.parentElement!.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>

          <div className="tutorial-hints-list">
            {PLATFORM_HINTS[id].map((hint, i) => (
              <div key={i} className="tutorial-hint-item">
                <span className="tutorial-step-num tutorial-step-badge">
                  {i + 1}
                </span>
                <p className="tutorial-step-text">
                  {hint.text}
                  {hint.link && (
                    <>
                      {' '}
                      <a
                        href={hint.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="platform-link"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {hint.link.label}
                      </a>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>

          <input
            type="text"
            className={`glass-input${validation ? (validation.ok ? ' border-success' : ' border-error') : ''}`}
            style={{ padding: '12px', fontSize: '14px', marginBottom: '6px' }}
            placeholder="粘贴链接 或 填写 ID"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
          />

          {validation && (
            <p className={`validation-message${validation.ok ? ' text-success' : ' text-error'}`}>
              {validation.msg}
              {validation.ok && validation.url && (
                <a
                  href={validation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  {validation.url}
                </a>
              )}
            </p>
          )}

          <p className="example-text">
            示例：{PLATFORM_EXAMPLES[id]}
          </p>

          <div className="ref-platform-actions">
            <button
              type="button"
              className="btn btn-secondary ref-inline-action"
              onClick={() => onShowTutorial(id)}
            >
              查看示例教程
            </button>
            <button
              type="button"
              className="btn btn-secondary ref-inline-action"
              onClick={() => onCopy(PLATFORM_EXAMPLES[id], `已复制 ${name} 示例`)}
            >
              复制示例
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-confirm-binding"
            disabled={!!validation && !validation.ok}
            onClick={handleBind}
          >
            确认绑定
          </button>
        </div>
      )}
    </div>
  );
}
