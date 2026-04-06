"use client";

import { useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import './globals.css';
import { resolvePlatformUrl, type PlatformKey } from '@/lib/platformUrls';
import { SoulReportRef } from '@/components/SoulReportRef';

const TOTAL_ONBOARD_STEPS = 4;

const PLATFORM_EXAMPLES: Record<PlatformKey, string> = {
  weibo:   'https://weibo.com/u/你的数字ID  或直接填数字ID',
  xhs:     '你的小红书号（纯数字，不是昵称）',
  douyin:  'https://www.douyin.com/user/MS4wLjAB…（完整主页链接）',
  netease: 'https://music.163.com/user/home?id=你的数字ID  或直接填数字ID',
  douban:  'https://www.douban.com/people/你的ID/  或直接填ID',
  zhihu:   'https://www.zhihu.com/people/你的用户名  或直接填用户名',
};

/** 每个平台的分步操作指引（让用户找到自己的链接/ID） */
const PLATFORM_HINTS: Record<PlatformKey, string[]> = {
  weibo:   [
    '打开微博网页版 weibo.com',
    '点击右上角头像 → 进入你的个人主页',
    '复制地址栏链接（形如 weibo.com/u/数字ID），粘贴到输入框',
  ],
  xhs:     [
    '打开小红书 App，点击底部「我」',
    '点击「编辑资料」（头像下方）',
    '找到「小红书号」一栏，复制这串数字（不是昵称）',
    '将数字粘贴到输入框即可',
  ],
  douyin:  [
    '方法 A（App）：点底部「我」→ 右上角三横 → 分享 → 复制链接',
    '方法 B（网页）：在电脑浏览器打开 douyin.com，进入你的主页，复制地址栏完整链接',
    '粘贴到输入框，系统会自动识别',
  ],
  netease: [
    '打开网易云音乐网页版 music.163.com',
    '点击右上角头像 → 我的主页',
    '复制地址栏链接（形如 music.163.com/user/home?id=数字ID），粘贴到输入框',
  ],
  douban:  [
    '打开豆瓣网页版 douban.com',
    '点击右上角头像 → 个人主页',
    '复制地址栏链接（形如 douban.com/people/你的ID/），粘贴到输入框',
  ],
  zhihu:   [
    '打开知乎网页版 zhihu.com',
    '点击右上角头像 → 个人主页',
    '复制地址栏链接（形如 zhihu.com/people/你的用户名），粘贴到输入框',
  ],
};

const PLATFORM_NAMES: Record<PlatformKey, string> = {
  weibo: '微博',
  xhs: '小红书',
  douyin: '抖音',
  netease: '网易云音乐',
  douban: '豆瓣',
  zhihu: '知乎',
};

const PLATFORM_KEYS = Object.keys(PLATFORM_NAMES) as PlatformKey[];

/** 与界面「示例」一致的可解析默认值（debug=1 时预填各平台输入框） */
const DEBUG_PLATFORM_DEFAULTS: Record<PlatformKey, string> = {
  weibo: 'https://weibo.com/u/7487955617',
  xhs: '416227302',
  douyin: 'https://www.douyin.com/user/MS4wLjABAAAAExamplePlaceholder000000000000',
  netease: 'https://music.163.com/#/user/home?id=530688535',
  douban: 'https://www.douban.com/people/26863705/',
  zhihu: 'https://www.zhihu.com/people/xiongsiji',
};

const DEBUG_DEFAULT_EMAIL = 'debug@soulmatch.local';
const DEBUG_DEFAULT_PASSWORD = 'debug123456';
const DEBUG_TEXT_STEP3 = '【Debug 模式】这是一段用于快速联调的心声示例。';
const DEBUG_TEXT_STEP4 = '【Debug】如果明天世界末日，今晚想好好吃一顿、和在乎的人待在一起。';

const SESSION_DEBUG_KEY = 'soulmatch_debug';

function readDebugModeFromLocation(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get('debug') === '0' || q.get('mode') === 'production') {
    sessionStorage.removeItem(SESSION_DEBUG_KEY);
    return false;
  }
  if (q.get('debug') === '1' || q.get('mode') === 'debug') {
    sessionStorage.setItem(SESSION_DEBUG_KEY, '1');
    return true;
  }
  return sessionStorage.getItem(SESSION_DEBUG_KEY) === '1';
}

/** Debug：是否跳过自动登录（仅手动点登录） */
function readDebugSkipAutoLogin(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autologin') === '0';
}

function FamiliarityHeart({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="ref-familiarity-float">
      <span className="ref-familiarity-label">了解程度</span>
      <div className="ref-familiarity-heart" aria-hidden>
        <div className="ref-familiarity-fill" style={{ height: `${p}%` }} />
        <span className="ref-familiarity-num">{p}%</span>
      </div>
    </div>
  );
}

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
  const [debugMode, setDebugMode] = useState(false);

  const [bindings, setBindings] = useState<Record<PlatformKey, string>>({
    weibo: '', xhs: '', douyin: '', netease: '', douban: '', zhihu: ''
  });
  /** Canonical profile URLs successfully persisted for this session */
  const [savedPlatforms, setSavedPlatforms] = useState<Partial<Record<PlatformKey, string>>>({});
  const [activeInput, setActiveInput] = useState<PlatformKey | null>(null);
  /** 实时校验结果 */
  const [validations, setValidations] = useState<Partial<Record<PlatformKey, { ok: boolean; msg: string; url?: string }>>>({}); 
  /** 分析步骤进度文字 */
  const [analysisStatus, setAnalysisStatus] = useState('正在整合你提供的信息…');
  /** step 3 文字输入 */
  const [textInput3, setTextInput3] = useState('');
  /** step 4 文字输入 */
  const [textInput4, setTextInput4] = useState('');
  /** 语音识别状态 */
  const [isRecording, setIsRecording] = useState(false);
  /** 朋友圈截图 / 生活照（服务端路径，与设计稿 0/5、0/10 对应） */
  const [momentsUrls, setMomentsUrls] = useState<string[]>([]);
  const [lifePhotoUrls, setLifePhotoUrls] = useState<string[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<'moments' | 'life' | null>(null);

  /**
   * Debug：?debug=1 或 ?mode=debug；关闭用 ?debug=0。同会话内会记住（sessionStorage）。
   * 默认：预填后自动登录并进入「开始建档」新首页，然后自动绑定所有平台。
   * 若只想看登录页：?debug=1&autologin=0
   */
  useEffect(() => {
    const active = readDebugModeFromLocation();
    setDebugMode(active);
    if (!active) return;
    setBindings((b) => ({ ...b, ...DEBUG_PLATFORM_DEFAULTS }));
    setEmail(DEBUG_DEFAULT_EMAIL);
    setPassword(DEBUG_DEFAULT_PASSWORD);
    setTextInput3(DEBUG_TEXT_STEP3);
    setTextInput4(DEBUG_TEXT_STEP4);
    const nextVal: Partial<Record<PlatformKey, { ok: boolean; msg: string; url?: string }>> = {};
    for (const id of PLATFORM_KEYS) {
      const val = DEBUG_PLATFORM_DEFAULTS[id];
      const r = resolvePlatformUrl(id, val);
      nextVal[id] = r.ok
        ? { ok: true, msg: '✓ 解析成功：', url: (r as { ok: true; url: string }).url }
        : { ok: false, msg: `✗ ${(r as { ok: false; error: string }).error}` };
    }
    setValidations((v) => ({ ...v, ...nextVal }));

    if (readDebugSkipAutoLogin()) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tryLogin = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: DEBUG_DEFAULT_EMAIL,
            password: DEBUG_DEFAULT_PASSWORD,
          }),
        });
        const loginData = await tryLogin.json().catch(() => ({}));
        if (cancelled) return;
        if (tryLogin.ok && loginData.user) {
          setUser(loginData.user);
          setStep(0);
          // Debug 模式：自动绑定所有平台
          setTimeout(() => autoBindAllPlatforms(), 1000);
          return;
        }
        const tryReg = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: DEBUG_DEFAULT_EMAIL,
            password: DEBUG_DEFAULT_PASSWORD,
            name: 'debug',
          }),
        });
        const regData = await tryReg.json().catch(() => ({}));
        if (cancelled) return;
        if (tryReg.ok && regData.user) {
          setUser(regData.user);
          setStep(0);
          // Debug 模式：自动绑定所有平台
          setTimeout(() => autoBindAllPlatforms(), 1000);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const uploadScreenshotFile = async (file: File, slot: 'moments' | 'life') => {
    const max = slot === 'moments' ? 5 : 10;
    const current = slot === 'moments' ? momentsUrls.length : lifePhotoUrls.length;
    if (current >= max) return;
    setSaveMessage(null);
    setUploadingSlot(slot);
    setStepUploadProgress(35);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'screenshot');
    const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
    const data = await res.json().catch(() => ({} as { error?: string; upload?: { url?: string } }));
    if (res.ok) {
      setStepUploadProgress(100);
      const path = data.upload?.url;
      if (path) {
        if (slot === 'moments') setMomentsUrls((p) => [...p, path]);
        else setLifePhotoUrls((p) => [...p, path]);
      }
      setSaveMessage('截图已添加，将用于档案分析');
      setTimeout(() => setStepUploadProgress(0), 450);
    } else {
      const err = data.error ?? '';
      const hint = err === '未登录' || err === '无效Token'
        ? '登录状态已失效，请刷新页面后重新登录再试。'
        : (err || '保存失败，请重试');
      alert(hint);
      setStepUploadProgress(0);
    }
    setUploadingSlot(null);
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
      if (!debugMode) alert(`${PLATFORM_NAMES[platformId]} 绑定成功`);
    } else {
      const err = data.error ?? '';
      const hint = err === '未登录' || err === '无效Token'
        ? '登录状态已失效，请刷新后重新登录。'
        : (err || '绑定失败');
      alert(hint);
      setStepUploadProgress(0);
    }
  };

  // Debug 模式：自动绑定所有平台
  const autoBindAllPlatforms = async () => {
    if (!debugMode) return;
    console.log('[Debug] 开始自动绑定所有平台...');
    for (const platformId of PLATFORM_KEYS) {
      const raw = DEBUG_PLATFORM_DEFAULTS[platformId];
      const resolved = resolvePlatformUrl(platformId, raw);
      if (!resolved.ok) continue;

      const payload = JSON.stringify({
        profileUrl: resolved.url,
        extractedId: resolved.extractedId,
        platform: platformId,
      });

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: `platform:${platformId}`,
            content: payload,
          }),
        });
        if (res.ok) {
          setSavedPlatforms((prev) => ({ ...prev, [platformId]: resolved.url }));
          console.log(`[Debug] ${PLATFORM_NAMES[platformId]} 绑定成功`);
        }
      } catch (err) {
        console.error(`[Debug] ${PLATFORM_NAMES[platformId]} 绑定失败:`, err);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log('[Debug] 所有平台绑定完成');
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
        setAnalysisResult(
          data.report
            ? { ...data.report, mbtiIp: data.mbtiIp ?? null }
            : data.report,
        );
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

  const saveSoulPosterImage = async () => {
    const el = document.getElementById('soul-poster-capture');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#3A1C59',
      });
      const link = document.createElement('a');
      link.download = `soulmatch_${user?.name ?? 'profile'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('保存失败，请截图保存');
    }
  };

  if (step === -1) {
    return (
      <div id="app">
        {debugMode && (
          <div
            className="debug-mode-badge"
            title="Debug：自动登录后进建档首页；仅预填不跳转请加 &autologin=0。关闭 ?debug=0"
          >
            DEBUG
          </div>
        )}
        <div className="bg-gradient" />
        <div className="glow-orb orb-1" />
        <div className="glow-orb orb-2" />
        <div className="view-container">
          <div className="view-content view-home ref-auth-screen">
            <div className="ref-home-top">
              <div className="hero-icon-container">
                <div className="hero-icon ref-home-sparkle" aria-hidden>
                  ✨
                </div>
              </div>
              <h1 className="title ref-home-title" style={{ textAlign: 'center' }}>
                全网最准分身
              </h1>
              <p className="ref-auth-sub">登录后开始建档，档案仅你本人可见</p>
            </div>
            {debugMode && (
              <p className="ref-auth-debug-hint">
                Debug：邮箱与密码已预填；建档时各平台输入框为示例 URL。
              </p>
            )}
            <form
              className="ref-auth-form"
              onSubmit={handleAuth}
            >
              <input type="email" placeholder="输入邮箱" className="glass-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="输入密码" className="glass-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button disabled={loading} className="btn btn-primary btn-glow" type="submit">{loading ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}</button>
            </form>
            <p className="ref-auth-switch" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? '没有账号？点击立刻注册' : '已有账号？点击返回登录'}
            </p>
            <p className="ref-home-privacy">
              不放心数据？
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                查看详细数据获取范围 &gt;
              </a>
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
          <div className="p-status">{isBound ? '已绑定' : '未绑定'}</div>
        </div>

        {persisted && (
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginTop: '6px', paddingLeft: '4px', wordBreak: 'break-all' }}>
            主页链接：<a href={persisted} target="_blank" rel="noopener noreferrer" style={{ color: '#00f2fe', textDecoration: 'underline' }}>{persisted}</a>
          </p>
        )}

        {isActive && (
          <div style={{ padding: '16px', marginTop: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* 分步操作指引 */}
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.4px' }}>
              📋 如何获取你自己的链接
            </p>
            <div style={{ marginBottom: '14px' }}>
              {PLATFORM_HINTS[id].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: '18px', height: '18px', borderRadius: '50%',
                    background: 'rgba(167,139,250,0.25)', color: '#c4b5fd',
                    fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{step}</p>
                </div>
              ))}
            </div>
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
                    setValidations((v) => ({ ...v, [id]: { ok: true, msg: '✓ 解析成功：', url: r.url } }));
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

  const boundPlatformCount = Object.keys(savedPlatforms).length;
  /** 设计稿：阶段 1/4→25% … 4/4→100% */
  const progressPercent =
    step >= 1 && step <= TOTAL_ONBOARD_STEPS
      ? Math.min(100, Math.round((step / TOTAL_ONBOARD_STEPS) * 100))
      : 0;
  /** 了解程度心形：与进度条保持一致 */
  const familiarityPercent = progressPercent;

  return (
    <div id="app" className={step === 7 ? 'app-mode-ref-report' : undefined}>
      {debugMode && (
        <div
          className="debug-mode-badge"
          title="Debug 模式。关闭：?debug=0"
        >
          DEBUG
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

      <div
        className={`view-container${step >= 1 && step <= TOTAL_ONBOARD_STEPS ? ' view-container-step' : ''}`}
      >
        {step === 0 && (
          <div className="view-content view-home ref-home-screen">
            <div className="ref-home-top">
              <div className="hero-icon-container">
                <div className="hero-icon ref-home-sparkle" aria-hidden>
                  ✨
                </div>
              </div>
              <h1 className="title ref-home-title">全网最准分身</h1>
              <p className="ref-home-welcome">欢迎，{user?.name ?? '朋友'}</p>
            </div>

            <div className="ref-home-cards">
              <div className="ref-home-card">
                <h3 className="ref-home-card-h">一分钟创建分身</h3>
                <p className="ref-home-card-p">
                  拒绝复杂填写流程，只需要绑定你的社交账号/上传图片，立即为你准确分析出你真正的性格底色！
                </p>
              </div>
              <div className="ref-home-card">
                <h3 className="ref-home-card-h">分身能干什么？</h3>
                <p className="ref-home-card-p">
                  专属数字分身，懂你偏好、精准识人；只推感兴趣内容，帮你告别海量无效信息。分身的无限可能正在开发中……
                </p>
              </div>
            </div>

            <p className="ref-home-privacy">
              不放心数据？
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
              >
                查看详细数据获取范围 &gt;
              </a>
            </p>

            <div className="bottom-action ref-home-cta">
              <button type="button" className="btn btn-primary btn-glow" onClick={() => setStep(1)}>
                开始建档
              </button>
            </div>
          </div>
        )}

        {step >= 1 && step <= TOTAL_ONBOARD_STEPS && (
          <div className="view-content view-step ref-step-shell">
            <FamiliarityHeart pct={familiarityPercent} />

            <div className="step-header">
              <button type="button" className="btn-back" onClick={() => setStep(step - 1)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <div className="step-progress-text ref-stage-pill">
                阶段 {step} / {TOTAL_ONBOARD_STEPS}
              </div>
              <div style={{ width: 24 }} />
            </div>

            <div className="ref-progress-block">
              <div className="ref-progress-row">
                <span>建档总进度</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="ref-progress-track">
                <div className="ref-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              {saveMessage && <p className="ref-progress-hint">{saveMessage}</p>}
            </div>

            {step === 1 && (
              <div className="step-body ref-step1-body">
                <h2 className="step-title ref-step-h2">上传朋友圈截图</h2>
                <p className="step-desc">任选能代表你线上气质的一张图，也可跳过。</p>
                <div className="ref-upload-cap">
                  <span>{momentsUrls.length}/5</span>
                </div>
                <div
                  className={`upload-area ref-upload-dashed${uploadingSlot === 'moments' ? ' ref-upload-busy' : ''}`}
                  onClick={() => document.getElementById('file-moments')?.click()}
                >
                  {momentsUrls.length > 0 ? (
                    <div className="ref-upload-thumb-grid">
                      {momentsUrls.map((u) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={u} src={u} alt="" className="ref-upload-thumb" />
                      ))}
                    </div>
                  ) : (
                    <div className="upload-icon">📸</div>
                  )}
                  <div className="upload-text">
                    {uploadingSlot === 'moments' ? '正在上传…' : '点击可更换图片'}
                  </div>
                  <input
                    id="file-moments"
                    type="file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadScreenshotFile(f, 'moments');
                      e.target.value = '';
                    }}
                  />
                </div>

                <h2 className="step-title ref-step-h2 ref-step-h2-second">上传最近生活照片</h2>
                <div className="ref-upload-cap">
                  <span>{lifePhotoUrls.length}/10</span>
                </div>
                <div
                  className={`upload-area ref-upload-dashed${uploadingSlot === 'life' ? ' ref-upload-busy' : ''}`}
                  onClick={() => document.getElementById('file-life')?.click()}
                >
                  {lifePhotoUrls.length > 0 ? (
                    <div className="ref-upload-thumb-grid">
                      {lifePhotoUrls.map((u) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={u} src={u} alt="" className="ref-upload-thumb" />
                      ))}
                    </div>
                  ) : (
                    <div className="upload-icon">🖼</div>
                  )}
                  <div className="upload-text">
                    {uploadingSlot === 'life' ? '正在上传…' : '点击可更换图片'}
                  </div>
                  <input
                    id="file-life"
                    type="file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadScreenshotFile(f, 'life');
                      e.target.value = '';
                    }}
                  />
                </div>

                <div className="bottom-action">
                  <button type="button" className="btn btn-primary btn-glow" onClick={() => setStep(2)}>
                    下一步 →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="step-body">
                <h2 className="step-title ref-platform-main-title">
                  社交平台（仅获取公开数据，用来创建分身）
                </h2>
                <p className="ref-platform-yellow">
                  通过你填写的本人社交账号，创建独一无二的你的专属数字分身，绑定越多你的分身将越像你。所有数据均在此平台你本人使用，随时可解绑，无隐私风险。
                </p>
                <div className="platform-list">
                  {renderPlatformRow('xhs', PLATFORM_NAMES.xhs, '📕', '#FFE6E6', '#FF2442')}
                  {renderPlatformRow('weibo', PLATFORM_NAMES.weibo, '👀', '#FFF0E6', '#FF8200')}
                  {renderPlatformRow('douyin', PLATFORM_NAMES.douyin, '🎵', '#2C2C2E', '#FFFFFF')}
                  {renderPlatformRow('netease', PLATFORM_NAMES.netease, '🎵', '#FFEAEA', '#E60026')}
                  {renderPlatformRow('douban', PLATFORM_NAMES.douban, '🎬', '#E6F7EA', '#00B51D')}
                  {renderPlatformRow('zhihu', PLATFORM_NAMES.zhihu, '💡', '#E6F0FF', '#0066FF')}
                </div>
                <div className="bottom-action">
                  <button type="button" className="btn btn-primary btn-glow" onClick={() => setStep(3)}>
                    跳过
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="step-body ref-chat-step">
                <h2 className="ref-chat-h1">让我更了解你吧</h2>
                <p className="ref-chat-sub">和你的分身聊一聊，加深熟悉度吧！</p>
                <div className="ref-chat-row">
                  <div className="ref-chat-avatar" aria-hidden>
                    🧙
                  </div>
                  <div className="ref-chat-bubble">
                    <div className="ref-bubble-title">人格底色深度分析</div>
                    <div className="ref-bubble-body">
                      我是一个什么样的人？更容易被什么样的人吸引？
                    </div>
                  </div>
                </div>
                <textarea
                  id="text-input"
                  className="glass-input ref-chat-textarea"
                  placeholder="输入你想说的心声…"
                  rows={5}
                  value={textInput3}
                  onChange={(e) => setTextInput3(e.target.value)}
                />
                <div className="ref-chat-toolbar">
                  <span className="ref-chat-tool-ico" aria-hidden>
                    ⌨
                  </span>
                  <button
                    type="button"
                    className="ref-chat-mic"
                    aria-label="语音输入"
                    onClick={() => {
                      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                      if (!SR) {
                        alert('当前浏览器不支持语音输入，请手动输入');
                        return;
                      }
                      if (isRecording) return;
                      const rec = new SR();
                      rec.lang = 'zh-CN';
                      rec.continuous = false;
                      rec.interimResults = false;
                      setIsRecording(true);
                      rec.onresult = (e: any) => {
                        const t = e.results[0][0].transcript;
                        setTextInput3((prev) => (prev ? `${prev}，${t}` : t));
                      };
                      rec.onerror = () => setIsRecording(false);
                      rec.onend = () => setIsRecording(false);
                      rec.start();
                    }}
                  >
                    {isRecording ? '⏹' : '🎤'}
                  </button>
                  <span style={{ flex: 1 }} />
                </div>
                <div className="bottom-action">
                  <button
                    type="button"
                    className="btn btn-primary btn-glow"
                    onClick={() => {
                      if (textInput3.trim()) {
                        void uploadText(textInput3, 'text', true);
                      } else {
                        setStep(4);
                      }
                    }}
                  >
                    {stepUploadProgress > 0 ? '保存中…' : textInput3.trim() ? '保存并继续 →' : '跳过'}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="step-body ref-chat-step">
                <h2 className="ref-chat-h1">让我更了解你吧</h2>
                <p className="ref-chat-sub">和你的分身聊一聊，加深熟悉度吧！</p>
                <div className="ref-chat-row">
                  <div className="ref-chat-avatar" aria-hidden>
                    🧙
                  </div>
                  <div className="ref-chat-bubble">
                    <div className="ref-bubble-title">主观意图</div>
                    <div className="ref-bubble-body">「如果明天世界末日，你今晚会做什么？」</div>
                  </div>
                </div>
                <textarea
                  className="glass-input ref-chat-textarea"
                  placeholder="输入你的回答…"
                  rows={4}
                  value={textInput4}
                  onChange={(e) => setTextInput4(e.target.value)}
                />
                <div className="ref-chat-toolbar">
                  <span className="ref-chat-tool-ico" aria-hidden>
                    ⌨
                  </span>
                  <button
                    type="button"
                    className="ref-chat-mic"
                    aria-label="语音输入"
                    onClick={() => {
                      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                      if (!SR) {
                        alert('当前浏览器不支持语音输入，请手动输入');
                        return;
                      }
                      if (isRecording) return;
                      const rec = new SR();
                      rec.lang = 'zh-CN';
                      rec.continuous = false;
                      rec.interimResults = false;
                      setIsRecording(true);
                      rec.onresult = (e: any) => {
                        const t = e.results[0][0].transcript;
                        setTextInput4((prev) => (prev ? `${prev}，${t}` : t));
                      };
                      rec.onerror = () => setIsRecording(false);
                      rec.onend = () => setIsRecording(false);
                      rec.start();
                    }}
                  >
                    {isRecording ? '⏹' : '🎤'}
                  </button>
                  <span style={{ flex: 1 }} />
                </div>
                <div className="bottom-action">
                  <button
                    type="button"
                    className="btn btn-primary btn-glow"
                    onClick={async () => {
                      if (textInput4.trim()) await uploadText(textInput4, 'voice-text', false);
                      startAnalysis();
                    }}
                  >
                    {textInput4.trim() ? '生成灵魂档案 →' : '跳过'}
                  </button>
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
          <SoulReportRef
            analysisResult={analysisResult}
            user={user}
            userScreenshotUrls={userScreenshotUrls}
            onSaveImage={() => void saveSoulPosterImage()}
          />
        )}
      </div>
    </div>
  );
}
