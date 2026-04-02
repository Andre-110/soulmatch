"use client";

import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import './globals.css';
import { resolvePlatformUrl, type PlatformKey } from '@/lib/platformUrls';

const TOTAL_ONBOARD_STEPS = 4;

const PLATFORM_EXAMPLES: Record<PlatformKey, string> = {
  weibo:   'https://weibo.com/u/7487955617  或直接填数字ID',
  xhs:     '416227302  （你的小红书号，在「我」→「编辑资料」里查看）',
  douyin:  'https://www.douyin.com/user/MS4wLjABAAAA...  （登录网页版后从地址栏复制）',
  netease: 'https://music.163.com/#/user/home?id=530688535  或直接填数字ID',
  douban:  'https://www.douban.com/people/你的ID/  或直接填ID',
};

/** 每个平台的获取方式说明 */
const PLATFORM_HINTS: Record<PlatformKey, string> = {
  weibo:   '打开微博网页版 → 点击头像进入主页 → 复制地址栏链接',
  xhs:     '打开小红书 App → 我 → 编辑资料 → 复制「小红书号」填入',
  douyin:  '打开抖音网页版(douyin.com) → 登录 → 点击头像 → 复制地址栏完整链接（含 MS4w...）',
  netease: '打开网易云音乐 → 点击头像 → 我的主页 → 复制地址栏链接',
  douban:  '打开豆瓣网页 → 点击头像 → 个人主页 → 复制地址栏链接',
};

const PLATFORM_NAMES: Record<PlatformKey, string> = {
  weibo: '微博',
  xhs: '小红书',
  douyin: '抖音',
  netease: '网易云音乐',
  douban: '豆瓣',
};

const PLATFORM_KEYS = Object.keys(PLATFORM_NAMES) as PlatformKey[];
const PLATFORM_STEP_WEIGHT = 100 / TOTAL_ONBOARD_STEPS;

export default function App() {
  const [step, setStep] = useState(-1);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<{ id: string, name: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  /** 建档步骤上传的截图 URL（/uploads/...），与海报一并导出 */
  const [userScreenshotUrls, setUserScreenshotUrls] = useState<string[]>([]);
  const [stepUploadProgress, setStepUploadProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [bindings, setBindings] = useState<Record<PlatformKey, string>>({
    weibo: '', xhs: '', douyin: '', netease: '', douban: ''
  });
  /** Canonical profile URLs successfully persisted for this session */
  const [savedPlatforms, setSavedPlatforms] = useState<Partial<Record<PlatformKey, string>>>({});
  const [activeInput, setActiveInput] = useState<PlatformKey | null>(null);
  /** 实时校验结果 */
  const [validations, setValidations] = useState<Partial<Record<PlatformKey, { ok: boolean; msg: string }>>>({});
  /** 分析步骤进度文字 */
  const [analysisStatus, setAnalysisStatus] = useState('正在整合你提供的信息…');
  /** step 3 文字输入 */
  const [textInput3, setTextInput3] = useState('');
  /** step 4 文字输入 */
  const [textInput4, setTextInput4] = useState('');
  /** 语音识别状态 */
  const [isRecording, setIsRecording] = useState(false);
  /** 截图步骤：本地 blob 或服务端返回的相对路径 /uploads/... */
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const screenshotBlobRef = useRef<string | null>(null);

  const revokeScreenshotBlob = () => {
    if (screenshotBlobRef.current) {
      URL.revokeObjectURL(screenshotBlobRef.current);
      screenshotBlobRef.current = null;
    }
  };

  useEffect(() => () => revokeScreenshotBlob(), []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name: email.split('@')[0] })
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setUser(data.user);
      setStep(0);
    } else {
      alert(data.error);
    }
  };

  const uploadFile = async (file: File) => {
    setSaveMessage(null);
    revokeScreenshotBlob();
    const blobUrl = URL.createObjectURL(file);
    screenshotBlobRef.current = blobUrl;
    setScreenshotPreview(blobUrl);

    setStepUploadProgress(30);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'screenshot');
    const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
    const data = await res.json().catch(() => ({} as { error?: string; upload?: { url?: string } }));
    if (res.ok) {
      setStepUploadProgress(100);
      revokeScreenshotBlob();
      const path = data.upload?.url;
      if (path) setScreenshotPreview(path);
      setSaveMessage('截图已添加，将用于档案分析');
      setTimeout(() => { setStepUploadProgress(0); setStep((s) => s + 1); }, 900);
    } else {
      const err = data.error ?? '';
      const hint = err === '未登录' || err === '无效Token'
        ? '登录状态已失效，请刷新页面后重新登录再试。'
        : (err || '保存失败，请重试');
      alert(hint);
      revokeScreenshotBlob();
      setScreenshotPreview(null);
      setStepUploadProgress(0);
    }
  };

  const uploadText = async (content: string, type: string, goNext: boolean = true) => {
    setSaveMessage(null);
    setStepUploadProgress(50);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content, type })
    });
    const data = await res.json().catch(() => ({} as { error?: string }));
    if (res.ok) {
      setStepUploadProgress(100);
      setSaveMessage('已保存');
      if (goNext) setTimeout(() => { setStepUploadProgress(0); setStep((s) => s + 1); }, 600);
      else setTimeout(() => { setStepUploadProgress(0); }, 600);
      return true;
    } else {
      const err = data.error ?? '';
      const hint = err === '未登录' || err === '无效Token'
        ? '登录状态已失效，请刷新后重新登录。'
        : (err || '保存失败');
      alert(hint);
      setStepUploadProgress(0);
      return false;
    }
  };

  const bindPlatform = async (platformId: PlatformKey) => {
    const raw = bindings[platformId];
    const resolved = resolvePlatformUrl(platformId, raw);
    if (resolved.ok === false) {
      alert(resolved.error);
      return;
    }

    setSaveMessage(null);
    setStepUploadProgress(25);
    const payload = JSON.stringify({
      profileUrl: resolved.url,
      extractedId: resolved.extractedId,
      platform: platformId,
    });

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: `platform:${platformId}`,
        content: payload,
      }),
    });
    const data = await res.json().catch(() => ({} as { error?: string }));

    if (res.ok) {
      setStepUploadProgress(100);
      setSavedPlatforms((prev) => ({ ...prev, [platformId]: resolved.url }));
      setBindings((b) => ({ ...b, [platformId]: '' }));
      setActiveInput(null);
      setSaveMessage(`${PLATFORM_NAMES[platformId]} 已关联`);
      setTimeout(() => setStepUploadProgress(0), 400);
      alert(`${PLATFORM_NAMES[platformId]} 绑定成功`);
    } else {
      const err = data.error ?? '';
      const hint = err === '未登录' || err === '无效Token'
        ? '登录状态已失效，请刷新后重新登录。'
        : (err || '绑定失败');
      alert(hint);
      setStepUploadProgress(0);
    }
  };

  const startAnalysis = async () => {
    setStep(6);
    const steps = [
      '正在连接各平台数据源…',
      '正在读取微博、豆瓣公开信息…',
      '正在读取网易云听歌记录…',
      '正在获取抖音主页数据…',
      '正在截取小红书主页…',
      '正在分析你上传的截图…',
      '正在整合全部线索…',
      'AI 正在解读你的灵魂波段…',
      '即将完成，正在生成档案…',
    ];
    let i = 0;
    const timer = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setAnalysisStatus(steps[i]);
    }, 3500);
    try {
      setUserScreenshotUrls([]);
      const res = await fetch('/api/analyze', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAnalysisResult(data.report);
        setUserScreenshotUrls(Array.isArray(data.userScreenshotUrls) ? data.userScreenshotUrls : []);
        setStep(7);
      } else {
        alert('分析失败: ' + (data.error || '请求错误'));
        setStep(4);
      }
    } catch {
      alert('网络错误，请重试');
      setStep(4);
    } finally {
      clearInterval(timer);
    }
  };

  if (step === -1) {
    return (
      <div id="app">
        <div className="bg-gradient"></div><div className="glow-orb orb-1"></div><div className="glow-orb orb-2"></div>
        <div className="view-container">
          <div className="view-content view-home" style={{ justifyContent: 'center' }}>
            <h1 className="title" style={{ textAlign: 'center' }}>SOUL PROFILE</h1>
            <p className="subtitle" style={{ textAlign: 'center' }}>登录后即可保存你的灵魂档案，仅你本人可见</p>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px', margin: '0 auto', width: '100%' }}>
              <input type="email" placeholder="输入邮箱" className="glass-input" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="输入密码" className="glass-input" value={password} onChange={e => setPassword(e.target.value)} required />
              <button disabled={loading} className="btn btn-primary btn-glow" type="submit">{loading ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}</button>
            </form>
            <p style={{ textAlign: 'center', marginTop: '20px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? '没有账号？点击立刻注册' : '已有账号？点击返回登录'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderPlatformRow = (id: PlatformKey, name: string, iconStr: string, bg: string, color: string) => {
    const isActive = activeInput === id;
    const persisted = savedPlatforms[id];
    const isBound = !!persisted && !isActive;
    const validation = validations[id];
    return (
      <div style={{ marginBottom: '16px' }} key={id}>
        <div className={`platform-item ${isBound ? 'connected' : ''}`} onClick={() => setActiveInput(isActive ? null : id)}>
          <div className="p-icon" style={{ background: bg, color: color }}>{iconStr}</div>
          <div className="p-info">{name}</div>
          <div className="p-status">{isBound ? '已关联' : '未绑定'}</div>
        </div>

        {persisted && (
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginTop: '6px', paddingLeft: '4px', wordBreak: 'break-all' }}>
            主页链接：{persisted}
          </p>
        )}

        {isActive && (
          <div style={{ padding: '16px', marginTop: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* 获取方式说明 */}
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginBottom: '10px', lineHeight: 1.6 }}>
              📋 {PLATFORM_HINTS[id]}
            </p>
            <input
              type="text"
              className="glass-input"
              style={{ padding: '12px', fontSize: '14px', marginBottom: '6px', borderColor: validation ? (validation.ok ? 'rgba(0,255,120,0.5)' : 'rgba(255,80,80,0.5)') : undefined }}
              placeholder="粘贴链接 或 填写 ID"
              value={bindings[id]}
              onChange={(e) => {
                const val = e.target.value;
                setBindings({ ...bindings, [id]: val });
                if (val.trim()) {
                  const r = resolvePlatformUrl(id, val);
                  if (r.ok) {
                    setValidations((v) => ({ ...v, [id]: { ok: true, msg: `✓ 解析成功：${r.url}` } }));
                  } else {
                    const errMsg = (r as { ok: false; error: string }).error;
                    setValidations((v) => ({ ...v, [id]: { ok: false, msg: `✗ ${errMsg}` } }));
                  }
                } else {
                  setValidations((v) => ({ ...v, [id]: undefined }));
                }
              }}
            />
            {/* 实时校验结果 */}
            {validation && (
              <p style={{ fontSize: '11px', marginBottom: '8px', color: validation.ok ? 'rgba(0,255,120,0.9)' : 'rgba(255,100,100,0.9)', wordBreak: 'break-all' }}>
                {validation.msg}
              </p>
            )}
            {/* 示例 */}
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', wordBreak: 'break-all' }}>
              示例：{PLATFORM_EXAMPLES[id]}
            </p>
            <button type="button" className="btn btn-primary" style={{ padding: '10px', fontSize: '14px' }} disabled={!!validation && !validation.ok} onClick={() => bindPlatform(id)}>
              确认绑定
            </button>
          </div>
        )}
      </div>
    );
  };

  /** 阶段内细则：第 2 步随已绑定平台数量 0→5 在 25%～75% 之间变化（每绑定一个平台 +10%，视觉更明显） */
  const boundPlatformCount = Object.keys(savedPlatforms).length;
  const progressPercent = (() => {
    if (step < 1 || step > TOTAL_ONBOARD_STEPS) return 0;
    if (step === 2) {
      const PLATFORM_RANGE = 40; // 平台步骤占 40% 区间：25% → 65%（每个平台 +8%，step3 仍在 75% 推进）
      const slice = (boundPlatformCount / PLATFORM_KEYS.length) * PLATFORM_RANGE;
      return Math.min(100, Math.round(PLATFORM_STEP_WEIGHT + slice));
    }
    return Math.min(100, Math.round((step / TOTAL_ONBOARD_STEPS) * 100));
  })();

  return (
    <div id="app">
      {/* Top strip + safe area */}
      {step >= 1 && step <= TOTAL_ONBOARD_STEPS && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'rgba(0,0,0,0.45)',
        }}>
          <div style={{ height: '10px', width: '100%', backgroundColor: 'rgba(0,0,0,0.35)' }}>
            <div style={{
              height: '100%',
              backgroundColor: '#FAF3B6',
              width: `${progressPercent}%`,
              transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 0 16px rgba(250,243,182,0.85)',
              borderBottomRightRadius: '4px',
              borderTopRightRadius: '4px',
            }} />
          </div>
        </div>
      )}

      {stepUploadProgress > 0 && (
        <div style={{
          position: 'fixed',
          top: 'calc(10px + env(safe-area-inset-top, 0px))',
          left: 0,
          right: 0,
          height: '5px',
          zIndex: 9998,
          background: 'rgba(0,0,0,0.25)',
        }}>
          <div style={{ height: '100%', backgroundColor: '#00f2fe', width: `${stepUploadProgress}%`, transition: 'width 0.3s linear' }} />
        </div>
      )}

      <div className="bg-gradient"></div><div className="glow-orb orb-1"></div><div className="glow-orb orb-2"></div>

      <div className="view-container" style={step >= 1 && step <= TOTAL_ONBOARD_STEPS ? { paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))' } : undefined}>
        {step === 0 && (
          <div className="view-content view-home">
            <div className="hero-icon-container"><div className="hero-icon">✨</div></div>
            <h1 className="title">欢迎，{user?.name}<br />开启全息灵魂建档</h1>
            <p className="subtitle">补充截图、主页与心声，我们会为你生成一张可分享的灵魂画像。</p>
            <div className="bottom-action"><button className="btn btn-primary btn-glow" onClick={() => setStep(1)}>开始建档</button></div>
          </div>
        )}

        {step >= 1 && step <= TOTAL_ONBOARD_STEPS && (
          <div className="view-content view-step">
            <div className="step-header">
              <button type="button" className="btn-back" onClick={() => setStep(step - 1)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <div className="step-progress-text" style={{ fontSize: '16px', letterSpacing: '2px' }}>阶段 {step} / {TOTAL_ONBOARD_STEPS}</div>
              <div style={{ width: 24 }}></div>
            </div>

            <div style={{ margin: '8px 0 12px', padding: '0 2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
                <span>建档总进度</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{
                height: '14px',
                borderRadius: '10px',
                background: 'rgba(0,0,0,0.35)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.18)',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #FAF3B6, #9d6fff)',
                  transition: 'width 0.5s ease',
                  boxShadow: '0 0 14px rgba(157,111,255,0.45)',
                }} />
              </div>
              {saveMessage && (
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--primary-light)' }}>{saveMessage}</p>
              )}
            </div>

            {step === 1 && (
              <div className="step-body">
                <h2 className="step-title">上传一张社交截图</h2>
                <p className="step-desc">任选能代表你线上气质的一张图，也可跳过。</p>
                <div className="upload-area" onClick={() => document.getElementById('file-upload')?.click()}>
                  {screenshotPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshotPreview}
                        alt=""
                        style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '16px', display: 'block', margin: '0 auto 12px' }}
                      />
                      <div className="upload-text">{stepUploadProgress > 0 ? '正在上传…' : '点击可更换图片'}</div>
                    </>
                  ) : (
                    <>
                      <div className="upload-icon">📸</div>
                      <div className="upload-text">{stepUploadProgress > 0 ? '正在上传…' : '点击选择图片'}</div>
                    </>
                  )}
                  <input id="file-upload" type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => {
                    if (e.target.files?.[0]) uploadFile(e.target.files[0]);
                    e.target.value = '';
                  }} />
                </div>
                <div className="bottom-action">
                  <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                    {screenshotPreview ? '下一步 →' : '跳过'}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="step-body">
                <h2 className="step-title">社交平台主页（全部在此绑定）</h2>
                <p className="step-desc">五个平台可选填。展开一行，粘贴个人主页链接或按示例填写即可。</p>
                <div className="platform-list">
                  {renderPlatformRow('xhs', PLATFORM_NAMES.xhs, '📕', '#FFE6E6', '#FF2442')}
                  {renderPlatformRow('weibo', PLATFORM_NAMES.weibo, '👀', '#FFF0E6', '#FF8200')}
                  {renderPlatformRow('douyin', PLATFORM_NAMES.douyin, '🎵', '#2C2C2E', '#FFFFFF')}
                  {renderPlatformRow('netease', PLATFORM_NAMES.netease, '🎵', '#FFEAEA', '#E60026')}
                  {renderPlatformRow('douban', PLATFORM_NAMES.douban, '🎬', '#E6F7EA', '#00B51D')}
                </div>
                <div className="bottom-action">
                  <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                    {boundPlatformCount > 0 ? `下一步 →（已绑定 ${boundPlatformCount} 个）` : '跳过'}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="step-body">
                <h2 className="step-title">写一段话</h2>
                <p className="step-desc">随便写几句当下的心情或自我介绍，字数不限。</p>
                <textarea id="text-input" className="glass-input" placeholder="输入你想输入的心声..." rows={5}
                  value={textInput3} onChange={(e) => setTextInput3(e.target.value)}></textarea>
                <div className="bottom-action">
                  <button type="button" className="btn btn-primary" onClick={() => {
                    if (textInput3.trim()) {
                      uploadText(textInput3, 'text', true);
                    } else {
                      setStep(4);
                    }
                  }}>{stepUploadProgress > 0 ? '保存中…' : textInput3.trim() ? '保存并继续 →' : '跳过'}</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="step-body">
                <h2 className="step-title">最后的主观意图</h2>
                <p className="step-desc">说出或写下此刻的心声，也可直接跳过生成档案。</p>
                <div className="question-card">「如果明天世界末日，你今晚会做什么？」</div>
                <textarea className="glass-input" placeholder="输入你的回答…" rows={3} style={{ marginTop: '16px' }}
                  value={textInput4} onChange={(e) => setTextInput4(e.target.value)} />
                {/* 语音输入按钮 */}
                <button type="button" style={{
                  marginTop: '12px', width: '100%', padding: '12px',
                  background: isRecording ? 'rgba(255,60,60,0.25)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${isRecording ? 'rgba(255,80,80,0.6)' : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: '12px', color: '#fff', fontSize: '14px', cursor: 'pointer',
                }} onClick={() => {
                  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                  if (!SR) { alert('当前浏览器不支持语音输入，请手动输入'); return; }
                  if (isRecording) return;
                  const rec = new SR();
                  rec.lang = 'zh-CN';
                  rec.continuous = false;
                  rec.interimResults = false;
                  setIsRecording(true);
                  rec.onresult = (e: any) => {
                    const t = e.results[0][0].transcript;
                    setTextInput4((prev) => prev ? prev + '，' + t : t);
                  };
                  rec.onerror = () => setIsRecording(false);
                  rec.onend = () => setIsRecording(false);
                  rec.start();
                }}>
                  {isRecording ? '🎙 正在聆听…' : '🎤 点击语音输入'}
                </button>
                <div className="bottom-action" style={{ marginTop: '16px' }}>
                  <button type="button" className="btn btn-primary btn-glow" onClick={async () => {
                    if (textInput4.trim()) await uploadText(textInput4, 'voice-text', false);
                    startAnalysis();
                  }}>{textInput4.trim() ? '生成灵魂档案 →' : '跳过，直接生成'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="view-content view-loading">
            <h2 className="loading-title">正在生成你的灵魂档案<br />请稍候…</h2>
            <div className="hatching-container"><div className="hatching-orb"></div></div>
            <p className="loading-status" style={{ minHeight: '48px', transition: 'opacity 0.4s', textAlign: 'center', padding: '0 24px' }}>{analysisStatus}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px', width: '100%', padding: '0 32px' }}>
              {[
                { label: '微博', done: analysisStatus.includes('网易云') || analysisStatus.includes('抖音') || analysisStatus.includes('小红书') || analysisStatus.includes('截图') || analysisStatus.includes('整合') || analysisStatus.includes('AI') || analysisStatus.includes('完成') },
                { label: '豆瓣', done: analysisStatus.includes('网易云') || analysisStatus.includes('抖音') || analysisStatus.includes('小红书') || analysisStatus.includes('截图') || analysisStatus.includes('整合') || analysisStatus.includes('AI') || analysisStatus.includes('完成') },
                { label: '网易云', done: analysisStatus.includes('抖音') || analysisStatus.includes('小红书') || analysisStatus.includes('截图') || analysisStatus.includes('整合') || analysisStatus.includes('AI') || analysisStatus.includes('完成') },
                { label: '抖音', done: analysisStatus.includes('小红书') || analysisStatus.includes('截图') || analysisStatus.includes('整合') || analysisStatus.includes('AI') || analysisStatus.includes('完成') },
                { label: '小红书', done: analysisStatus.includes('截图') || analysisStatus.includes('整合') || analysisStatus.includes('AI') || analysisStatus.includes('完成') },
                { label: '你上传的截图', done: analysisStatus.includes('整合') || analysisStatus.includes('AI') || analysisStatus.includes('完成') },
              ].map(({ label, done }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: done ? 'rgba(0,255,120,0.9)' : 'rgba(255,255,255,0.4)' }}>
                  <span style={{ fontSize: '16px' }}>{done ? '✓' : '⋯'}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 7 && analysisResult && (
          <div className="view-content view-result">
            <div className="soul-poster" id="soul-poster-capture">
              <div className="foil-shimmer" style={{ zIndex: 0 }}></div>
              <div className="poster-watermark">{analysisResult.mbti}</div>

              <div className="result-header" style={{ position: 'relative', zIndex: 2 }}>
                <div className="poster-date">SOULMATCH / VALIDATED RECORD</div>
                <div className="avatar-glow giant"><div className="avatar-inner"></div></div>
                <h2 className="result-name editorial">{user?.name}</h2>
                <p className="result-mbti">{analysisResult.title}</p>
                <div className="tags-wrap" style={{ marginTop: '16px' }}>
                  {analysisResult.avatarTags.map((tag: string, i: number) => <span key={i} className="tag ethereal">{tag}</span>)}
                </div>
              </div>

              <div className="divider"></div>

              {userScreenshotUrls.length > 0 && (
                <div className="result-card ethereal-card" style={{ zIndex: 2, position: 'relative', marginBottom: '20px' }}>
                  <h3 style={{ marginBottom: '16px' }}><span className="icon-sparkle">✦</span> 你上传的画面</h3>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '14px', lineHeight: 1.5 }}>
                    以下为你建档时上传的截图，已参与 AI 解读；保存海报时会一并收入。
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {userScreenshotUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt="用户上传截图"
                        style={{
                          width: '100%',
                          aspectRatio: '3 / 4',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="result-card ethereal-card" style={{ zIndex: 2, position: 'relative' }}>
                <h3 style={{ marginBottom: '24px' }}><span className="icon-sparkle">✦</span> 线索解读</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {analysisResult.blocks.map((b: any, index: number) => (
                    <div key={index} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', borderLeft: '4px solid var(--primary-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '20px' }}>{b.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>{b.source}</span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>{b.title}</div>
                      <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', marginBottom: '10px' }}>{b.description}</p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {b.tags.map((t: string, i2: number) => <span key={i2} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', color: '#fff' }}>#{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="qr-share-section inline" style={{ zIndex: 2 }}>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://soulmatch.app&color=3A1C59&bgcolor=ffffff" className="qr-code glossy" alt="Scan QR" />
                <div className="qr-text">灵魂档案已就绪<br /><span className="qr-sub">可截屏分享给朋友</span></div>
              </div>
            </div>

            <div className="bottom-action floating-actions">
              <button type="button" className="btn btn-primary btn-glow" onClick={async () => {
                const el = document.getElementById('soul-poster-capture');
                if (!el) return;
                try {
                  const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: '#3A1C59' });
                  const link = document.createElement('a');
                  link.download = `soulmatch_${user?.name ?? 'profile'}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
                } catch { alert('保存失败，请截图保存'); }
              }}>↓ 保存灵魂档案图片</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
