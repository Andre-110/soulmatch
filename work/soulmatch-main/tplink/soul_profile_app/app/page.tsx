"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import html2canvas from 'html2canvas';
import './globals.css';
import { resolvePlatformUrl, type PlatformKey } from '@/lib/platformUrls';
import { ANALYZE_STAGE_KEYS, type AnalyzeStageKey } from '@/lib/analyzeStages';
import { SoulReportRef } from '@/components/SoulReportRef';
import { APP_BASE_PATH } from '@/lib/appBasePath';
import { readAnalyzeNdjsonStream, readAnalyzeNdjsonStreamWithEvents, type AnalyzeSnapshot } from '@/lib/api/stream';
import { readDebugModeFromLocation, readUserSnapshot, persistUserSnapshot, readDebugSkipAutoLogin, readDebugFastTrack } from '@/lib/utils/client';
import { PrivacyNavLink } from '@/components/PrivacyNavLink';
import { FamiliarityHeart } from '@/components/FamiliarityHeart';
import { UploadSection } from '@/components/UploadSection';
import { HomeStep } from '@/components/onboarding/HomeStep';
import { UploadMediaStep } from '@/components/onboarding/UploadMediaStep';
import { PlatformBindingStep } from '@/components/onboarding/PlatformBindingStep';


const TOTAL_ONBOARD_STEPS = 4;

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

/** 每个平台的分步操作指引（让用户找到自己的链接/ID） */
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
    { text: '点击右上角头像 → 我的主页' },
    { text: '复制地址栏链接（形如 music.163.com/user/home?id=数字ID），粘贴到输入框' },
  ],
  douban:  [
    { text: '打开豆瓣网页版', link: { label: '官网入口', href: 'https://www.douban.com' } },
    { text: '点击右上角头像 → 个人主页' },
    { text: '复制地址栏链接（形如 douban.com/people/你的ID/），粘贴到输入框' },
  ],
  zhihu:   [
    { text: '打开知乎网页版', link: { label: '官网入口', href: 'https://www.zhihu.com' } },
    { text: '点击右上角头像 → 个人主页' },
    { text: '复制地址栏链接（形如 zhihu.com/people/你的用户名），粘贴到输入框' },
  ],
};

const PLATFORM_TUTORIAL_MEDIA: Record<
  PlatformKey,
  { src: string; alt: string; caption: string; pitfalls: string[] }
> = {
  weibo: {
    src: '/screenshots/weibo_2026-04-05T17-03-32.jpg',
    alt: '微博主页示例图',
    caption: '示例图展示的是微博个人主页，地址栏里通常会出现 `/u/数字ID`。',
    pitfalls: ['不要复制单条微博链接', '优先使用个人主页链接或纯数字 ID'],
  },
  xhs: {
    src: '/screenshots/xhs_2026-04-05T17-04-34.jpg',
    alt: '小红书主页示例图',
    caption: '小红书必须优先使用 App 分享链接，网页版主页直链多数情况下无法直接抓取。',
    pitfalls: ['不要直接贴网页版个人主页', '确保链接是 `xhslink.com/m/` 开头'],
  },
  douyin: {
    src: '/screenshots/douyin_2026-04-04T16-41-53.jpg',
    alt: '抖音主页示例图',
    caption: '抖音建议复制完整主页链接，系统会自动识别其中的用户标识。',
    pitfalls: ['不要只复制视频链接', '必须是 `douyin.com/user/...` 主页链接'],
  },
  netease: {
    src: '/screenshots/netease_2026-04-05T17-43-58.jpg',
    alt: '网易云主页示例图',
    caption: '网易云通常只需要个人主页里的数字 ID，也可以直接复制完整主页链接。',
    pitfalls: ['别复制歌单链接', '优先使用 `user/home?id=数字ID`'],
  },
  douban: {
    src: '/screenshots/douban_2026-04-05T17-44-09.jpg',
    alt: '豆瓣主页示例图',
    caption: '豆瓣个人主页链接通常是 `douban.com/people/你的ID/` 这种格式。',
    pitfalls: ['不要贴作品条目页', '复制个人主页或 `people/ID` 即可'],
  },
  zhihu: {
    src: '/screenshots/zhihu_2026-04-05T17-44-23.jpg',
    alt: '知乎主页示例图',
    caption: '知乎通常只需要个人主页里的用户名，也可以直接贴完整主页链接。',
    pitfalls: ['不要贴单篇回答链接', '优先复制 `zhihu.com/people/用户名`'],
  },
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
const XHS_BINDING_ENABLED = true;
const ACTIVE_PLATFORM_KEYS = PLATFORM_KEYS.filter((k) => (XHS_BINDING_ENABLED ? true : k !== 'xhs'));

/** 与界面「示例」一致的可解析默认值（debug=1 时预填各平台输入框） */
const DEBUG_PLATFORM_DEFAULTS: Record<PlatformKey, string> = {
  weibo: 'https://weibo.com/u/7487955617',
  xhs: 'https://xhslink.com/m/2q3yn1USahZ',
  douyin: 'https://www.douyin.com/user/MS4wLjABAAAAwBvVse-Ub8YW2GpdqATHmstGsvlNsdMWPM5clf3BQmM?from_tab_name=main',
  netease: 'https://music.163.com/#/user/home?id=530688535',
  douban: 'https://www.douban.com/people/26863705/',
  zhihu: 'https://www.zhihu.com/people/xiongsiji',
};

const DEBUG_DEFAULT_EMAIL = 'debug@soulmatch.local';
const DEBUG_DEFAULT_PASSWORD = 'debug123456';
const DEBUG_RELATIONSHIP_INTENT = '长期恋爱';
const SCALE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const LOCAL_TAG_OPTIONS = [
  '情绪稳定', '执行力强', '社恐', '搞笑女/男', '搞钱至上', '顾家', '慢热', '直球选手', '细节控', '冒险派',
  '共情力强', '高敏感', '理性务实', '浪漫主义', '松弛感', '行动派', '边界感强', '重承诺', '表达欲强', '佛系',
] as const;

const HOME_HIGHLIGHTS = [
  { value: '4 步', label: '完成建档' },
  { value: '6 平台', label: '公开线索接入' },
  { value: '1 份', label: '专属灵魂档案' },
] as const;

const HOME_FLOW = [
  { title: '上传线索', desc: '朋友圈截图、生活照和公开主页一起纳入分析。' },
  { title: '补全偏好', desc: '用一组短问答补足关系观、节奏感和边界感。' },
  { title: '生成分身', desc: '系统整合视觉、文本和平台公开痕迹输出完整报告。' },
] as const;

const STEP_INTRO: Record<number, { kicker: string; title: string; desc: string }> = {
  1: {
    kicker: 'Step 1',
    title: '先给系统一点生活切片',
    desc: '朋友圈截图最能还原你的表达方式、关注点和情绪张力，不需要太多，够真实就行。',
  },
  2: {
    kicker: 'Step 2',
    title: '补一层真实生活质感',
    desc: '最近的生活照会被用于识别场景偏好、审美气质和日常节奏，上传越克制越自然。',
  },
  3: {
    kicker: 'Step 3',
    title: '绑定公开主页，让分身更像你',
    desc: '这里只读取公开信息，不碰私密聊天和私域内容；越多公开痕迹，画像越稳定。',
  },
  4: {
    kicker: 'Step 4',
    title: '最后用问卷校准人格细节',
    desc: '问卷负责校正价值观、关系偏好和生活方式，让结果不只像你，还能贴近你想要的关系。',
  },
};

type QuestionType = 'profile' | 'single' | 'range' | 'tags' | 'scale' | 'text';
type ProfileAnswer = { nickname: string; gender: string; birthday: string };
type HeightPreferenceAnswer = { myHeight: number; preferredMin: number; preferredMax: number };
type QuestionnaireAnswer = string | string[] | number | ProfileAnswer | HeightPreferenceAnswer;
type QuestionnaireQuestion = {
  id: number;
  type: QuestionType;
  title: string;
  prompt: string;
  required?: boolean;
  helper?: string;
  options?: string[];
  placeholder?: string;
  scaleLeft?: string;
  scaleRight?: string;
};

const QUESTIONNAIRE: QuestionnaireQuestion[] = [
  { id: 1, type: 'profile', title: '基本身份', prompt: '昵称 / 性别 / 生日', required: true },
  { id: 2, type: 'single', title: '寻找目标', prompt: '你希望匹配的对象性别？', required: true, options: ['男', '女', '不限'] },
  { id: 3, type: 'single', title: '当前状态', prompt: '你目前处于什么阶段？', required: true, options: ['本科生', '硕博研究生', '已工作'] },
  { id: 4, type: 'single', title: '意向关系', prompt: '你更偏好的关系类型？', required: true, options: ['寻找结婚对象', '长期恋爱', '长期为主但也接受短期', '顺其自然'] },
  { id: 5, type: 'range', title: '身高及偏好', prompt: '通过滑块选择你的身高与期望对方身高范围', required: true, helper: '可拖动滑块微调，单位为 cm' },
  { id: 6, type: 'text', title: '年龄偏好', prompt: '期望对方的年龄范围', required: true, placeholder: '如：同龄、接受±3岁、偏好年上/年下' },
  { id: 7, type: 'single', title: '学历偏好', prompt: '你对学历的偏好是？', required: true, options: ['只看同等及以上', '无所谓'] },
  { id: 8, type: 'tags', title: '三个词形容自己', prompt: '从 20 个标签中选择 3 个最像你的', required: true, options: [...LOCAL_TAG_OPTIONS], helper: '请严格选择 3 个标签' },
  { id: 9, type: 'scale', title: '生育意愿', prompt: '绝对丁克 —— 非常想要孩子', required: true, scaleLeft: '1 绝对丁克', scaleRight: '7 非常想要孩子' },
  { id: 10, type: 'scale', title: '传统性别角色', prompt: '男主外女主内 的接受度', required: true, scaleLeft: '1 极度反感', scaleRight: '7 非常认同' },
  { id: 11, type: 'scale', title: '收入差距接受度', prompt: '伴侣比自己收入高/低很多，你的接受度', required: true, scaleLeft: '1 不接受', scaleRight: '7 完全不介意' },
  { id: 12, type: 'scale', title: '异性边界感', prompt: '伴侣有非常要好的异性闺蜜/兄弟，你的接受度', required: true, scaleLeft: '1 绝对不行', scaleRight: '7 完全正常' },
  { id: 13, type: 'scale', title: '消费倾向', prompt: '攒钱平替 —— 为体验与品质买单', required: true, scaleLeft: '1 精打细算', scaleRight: '7 活在当下' },
  { id: 14, type: 'scale', title: '伴侣督促我进步', prompt: '希望伴侣“鞭策我成长”吗？', required: true, scaleLeft: '1 接受现在的我', scaleRight: '7 希望共同成长' },
  { id: 15, type: 'scale', title: '未来定居偏好', prompt: '回老家/二三线 —— 一线城市打拼', required: true, scaleLeft: '1 回归安稳', scaleRight: '7 一线打拼' },
  { id: 16, type: 'scale', title: '抽烟喝酒接受度', prompt: '对伴侣抽烟/喝酒的接受程度', required: true, scaleLeft: '1 绝对不能', scaleRight: '7 完全不介意' },
  { id: 17, type: 'scale', title: '消息回复焦虑', prompt: '伴侣几小时不回微信，你会多焦虑？', required: true, scaleLeft: '1 完全不焦虑', scaleRight: '7 极度内耗' },
  { id: 18, type: 'scale', title: '黏人程度', prompt: '个人空间需求 —— 随时保持联系', required: true, scaleLeft: '1 非常独立', scaleRight: '7 非常黏人' },
  { id: 19, type: 'scale', title: '情感袒露', prompt: '戒备森严 —— 毫无保留', required: true, scaleLeft: '1 很难交心', scaleRight: '7 完全打开' },
  { id: 20, type: 'scale', title: '卧室主导权（可选）', prompt: '顺从/Sub —— 主导/Dom', required: false, scaleLeft: '1 偏顺从', scaleRight: '7 偏主导' },
  { id: 21, type: 'scale', title: '作息习惯', prompt: '夜猫子 —— 早起鸟', required: true, scaleLeft: '1 夜猫子', scaleRight: '7 早起鸟' },
  { id: 22, type: 'scale', title: '周末充电方式', prompt: '宅家独处 —— 外出社交', required: true, scaleLeft: '1 纯宅家', scaleRight: '7 高社交' },
  { id: 23, type: 'scale', title: '探索欲', prompt: '老店复刷 —— 打卡新店', required: true, scaleLeft: '1 常去老店', scaleRight: '7 一定新店' },
  { id: 24, type: 'scale', title: '生活整洁度容忍', prompt: '对伴侣邋遢/乱丢东西的容忍度', required: true, scaleLeft: '1 零容忍', scaleRight: '7 无所谓' },
  { id: 25, type: 'scale', title: '非传统约会接受度', prompt: '第一次约会去爬山/逛菜市场/玩密室', required: true, scaleLeft: '1 更偏传统', scaleRight: '7 越特别越好' },
  { id: 26, type: 'scale', title: '互联网原住民偏好', prompt: '伴侣不用社交媒体是否加分？', required: true, scaleLeft: '1 明显减分', scaleRight: '7 明显加分' },
  { id: 27, type: 'text', title: '普通的周二晚上', prompt: '晚上 8 点到 11 点，你通常在干嘛？', required: true, placeholder: '可包含具体活动与心情状态' },
  { id: 28, type: 'text', title: '没有安排的周末', prompt: '如果这个周末没有任何必须做的事，你会怎么度过？', required: true, placeholder: '可写你理想的一天安排' },
  { id: 29, type: 'text', title: '恋爱雷区', prompt: '亲密关系里你绝对无法接受的底线是什么？', required: true, placeholder: '如：冷暴力、撒谎、失联等' },
  { id: 30, type: 'text', title: '近期小确幸', prompt: '最近让你觉得“生活还不错”的一件小事是什么？', required: true, placeholder: '简短或详细都可以' },
];

const DEBUG_QUESTION_ANSWERS: Record<number, QuestionnaireAnswer> = {
  1: { nickname: 'Debug用户', gender: '不方便透露', birthday: '1998-08-08' },
  2: '不限',
  3: '已工作',
  4: '长期恋爱',
  5: { myHeight: 172, preferredMin: 165, preferredMax: 182 },
  6: '接受同龄或±3岁',
  7: '无所谓',
  8: ['情绪稳定', '执行力强', '松弛感'],
  9: 4,
  10: 2,
  11: 6,
  12: 3,
  13: 4,
  14: 6,
  15: 5,
  16: 2,
  17: 3,
  18: 4,
  19: 5,
  20: 4,
  21: 4,
  22: 5,
  23: 6,
  24: 3,
  25: 6,
  26: 4,
  27: '周二晚上一般会去健身 1 小时，回家做饭后刷会短视频。',
  28: '睡到自然醒，白天咖啡店看书，晚上找朋友吃饭。',
  29: '冷暴力和长期失联是我的关系底线。',
  30: '最近和老朋友线下见面聊天，感觉很放松。',
};

const ANALYZE_STAGE_META: Record<
  AnalyzeStageKey,
  { label: string; percent: number; eta: string }
> = {
  queued: { label: '已接收请求，准备开始分析…', percent: 6, eta: '预计 40-70 秒' },
  gathering: { label: '正在整理你刚刚提交的素材…', percent: 14, eta: '预计 35-60 秒' },
  scraping: { label: '正在连接平台并提取可用线索…', percent: 38, eta: '预计 25-45 秒' },
  vision: { label: '正在解读截图里的视觉细节…', percent: 58, eta: '预计 18-35 秒' },
  prompting: { label: 'AI 正在生成你的画像与报告…', percent: 82, eta: '预计 8-20 秒' },
  saving: { label: '正在整理结构并写入档案…', percent: 94, eta: '还差最后几秒' },
  done: { label: '灵魂档案已生成完成', percent: 100, eta: '已完成' },
};

type UploadSlot = 'moments' | 'life';
type StepUploadItem = {
  id: string;
  url: string;
};

type VoicePermissionState = 'unknown' | 'granted' | 'prompt' | 'denied' | 'unsupported';
type AnalysisSnapshotState = AnalyzeSnapshot;
type QuestionnaireSubmissionPayload = {
  questionnaireSummary: string;
  openTextSummary: string;
  matchIntentText: string;
};






export default function App() {
  const [step, setStep] = useState(0);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<{ id: string, name: string, email?: string } | null>(null);

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
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, QuestionnaireAnswer>>({});
  const [matchIntent, setMatchIntent] = useState('顺其自然');
  /** 语音识别状态 */
  const [recordingTarget, setRecordingTarget] = useState<number | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voicePermission, setVoicePermission] = useState<VoicePermissionState>('unknown');
  const [voiceHint, setVoiceHint] = useState<string>('点击麦克风即可开始语音输入。');
  const [debugPrefilledReady, setDebugPrefilledReady] = useState(false);
  const [tutorialPlatform, setTutorialPlatform] = useState<PlatformKey | null>(null);
  const [analysisStage, setAnalysisStage] = useState<AnalyzeStageKey>('queued');
  const [stageTimeline, setStageTimeline] = useState<StageTimelineEntry[]>([]);
  const [stageStats, setStageStats] = useState<Partial<Record<AnalyzeStageKey, { avgMs: number; count: number; maxMs: number; lastMs: number }>>>({});
  const [analysisSnapshot, setAnalysisSnapshot] = useState<AnalysisSnapshotState>({});
  const [submissionStartedAt, setSubmissionStartedAt] = useState<number | null>(null);
  /** 朋友圈截图 / 生活照（服务端上传记录，支持删除） */
  const [momentsUploads, setMomentsUploads] = useState<StepUploadItem[]>([]);
  const [lifePhotoUploads, setLifePhotoUploads] = useState<StepUploadItem[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);
  const speechRef = useRef<any>(null);
  const viewContainerRef = useRef<HTMLDivElement | null>(null);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const questionFlowTailRef = useRef<HTMLDivElement | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceQuestionRef = useRef<number | null>(null);
  const submitQuestionStepRef = useRef<() => Promise<void>>(async () => {});

  /**
   * Debug：仅在 URL 显式带 ?debug=1 或 ?mode=debug 时启用。
   * 默认：预填后自动登录并进入「开始建档」新首页，然后自动绑定所有平台。
   * 若只想看登录页：?debug=1&autologin=0
   */
  useEffect(() => {
    const active = readDebugModeFromLocation();
    const fastTrack = readDebugFastTrack();
    setDebugMode(active);
    if (!active) return;
    setBindings((b) => ({ ...b, ...DEBUG_PLATFORM_DEFAULTS }));
    setEmail(DEBUG_DEFAULT_EMAIL);
    setPassword(DEBUG_DEFAULT_PASSWORD);
    setMatchIntent(DEBUG_RELATIONSHIP_INTENT);
    setQuestionAnswers({ ...DEBUG_QUESTION_ANSWERS });
    const nextVal: Partial<Record<PlatformKey, { ok: boolean; msg: string; url?: string }>> = {};
    for (const id of ACTIVE_PLATFORM_KEYS) {
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
        // Debug 模式不复用现有会话，直接用单接口原子化重建 debug 用户与 cookie。
        await clearSessionAndSnapshot();
        const debugRes = await fetch('/api/auth/debug-session', {
          method: 'POST',
          credentials: 'include',
        });
        const loginData = await debugRes.json().catch(() => ({}));
        if (cancelled) return;
        if (debugRes.ok && loginData.user) {
          setUser(loginData.user);
          persistUserSnapshot(loginData.user);
          setStep(0);
          setTimeout(() => { void autoBindAllPlatforms({ jumpToQuestionnaire: fastTrack }); }, 1000);
          return;
        }
        setUser(null);
        setStep(-1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  // Debug 初始化仅首屏执行一次，避免重复触发自动登录与自动绑定
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const snap = readUserSnapshot();
    if (!snap) return;
    setUser((prev) => prev ?? snap);
    setStep((prev) => (prev === -1 ? 0 : prev));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host);
    const supported =
      Boolean((window as any).SpeechRecognition) ||
      Boolean((window as any).webkitSpeechRecognition);
    setVoiceSupported(supported);
    if (!supported) {
      setVoicePermission('unsupported');
      setVoiceHint('当前浏览器不支持语音识别，请直接使用键盘输入。');
      return;
    }

    if (!window.isSecureContext) {
      setVoiceHint(
        isLocalHost
          ? '当前地址没有被浏览器识别成安全环境，优先用 http://localhost:3010 打开。'
          : `当前地址 ${window.location.origin} 不是安全上下文；语音输入需改用 HTTPS 或 localhost。`,
      );
    }

    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;
    const syncPermission = async () => {
      try {
        if (!navigator.permissions?.query) return;
        permissionStatus = await navigator.permissions.query({
          // PermissionName 类型不包含 microphone 的历史浏览器兼容声明
          name: 'microphone' as PermissionName,
        });
        if (cancelled) return;
        const nextState = permissionStatus.state as VoicePermissionState;
        setVoicePermission(nextState);
        if (nextState === 'granted') {
          setVoiceHint('麦克风已授权，可直接语音输入。');
        } else if (nextState === 'denied') {
          setVoiceHint('麦克风权限已被拒绝，请在浏览器设置中重新开启。');
        } else {
          setVoiceHint('首次使用会请求麦克风权限，允许后即可语音输入。');
        }
        permissionStatus.onchange = () => {
          const changed = permissionStatus?.state as VoicePermissionState;
          setVoicePermission(changed);
          if (changed === 'granted') setVoiceHint('麦克风已授权，可直接语音输入。');
          else if (changed === 'denied') setVoiceHint('麦克风权限已被拒绝，请在浏览器设置中重新开启。');
          else setVoiceHint('首次使用会请求麦克风权限，允许后即可语音输入。');
        };
      } catch {
        // 某些浏览器不支持 permissions API，保留默认提示
      }
    };
    void syncPermission();
    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  useEffect(() => {
    if (readDebugModeFromLocation() && !readDebugSkipAutoLogin()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            await clearSessionAndSnapshot();
            if (!cancelled) {
              setUser(null);
              setStep(-1);
            }
          }
          return;
        }
        const data = await res.json().catch(() => ({} as { user?: { id: string; name: string; email?: string } }));
        if (cancelled || !data.user) return;
        const activeDebug = readDebugModeFromLocation();
        if (!activeDebug && data.user.email === DEBUG_DEFAULT_EMAIL) {
          await clearSessionAndSnapshot();
          setUser(null);
          setStep(-1);
          return;
        }
        setUser(data.user);
        persistUserSnapshot(data.user);
        setStep((prev) => (prev === -1 ? 0 : prev));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!speechRef.current) return;
      try {
        speechRef.current.onend = null;
        speechRef.current.stop();
      } catch {
        // ignore
      } finally {
        speechRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (step !== 4) return;
    // Debug 模式：直接显示所有问题为已回答状态
    if (debugMode && questionIndex === 0) {
      setQuestionIndex(QUESTIONNAIRE.length);
      return;
    }
    const timer = setTimeout(() => {
      questionFlowTailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      activeTextareaRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, [step, questionIndex, debugMode]);

  useEffect(() => {
    const container = viewContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    const container = viewContainerRef.current;
    if (!container) return;
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    };
    container.addEventListener('focusin', onFocusIn);
    return () => container.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    autoAdvanceQuestionRef.current = null;
  }, [questionIndex]);

  const appendRecognizedText = (targetId: number, transcript: string) => {
    const text = transcript.trim();
    if (!text) return;
    const append = (prev: string) => (prev ? `${prev}${/[，。！？\s]$/.test(prev) ? '' : '，'}${text}` : text);
    setQuestionAnswers((prev) => {
      const raw = prev[targetId];
      const base = typeof raw === 'string' ? raw : '';
      return { ...prev, [targetId]: append(base) };
    });
  };

  const stopSpeechInput = () => {
    if (!speechRef.current) return;
    try {
      speechRef.current.stop();
    } catch {
      // ignore
    } finally {
      speechRef.current = null;
      setRecordingTarget(null);
      setVoiceHint('语音输入已停止，可继续编辑文字。');
    }
  };

  const focusQuestionTextarea = () => {
    activeTextareaRef.current?.focus();
  };

  const clearSessionAndSnapshot = async () => {
    persistUserSnapshot(null);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.cookie = 'token=; Max-Age=0; path=/';
    }
  };

  const recoverExpiredSession = async (message: string) => {
    await clearSessionAndSnapshot();
    setUser(null);
    setAnalysisResult(null);
    setUserScreenshotUrls([]);
    setSavedPlatforms({});
    setMomentsUploads([]);
    setLifePhotoUploads([]);
    setSubmissionStartedAt(null);
    setStepUploadProgress(0);
    setStep(-1);
    if (debugMode && !readDebugSkipAutoLogin() && typeof window !== 'undefined') {
      alert(message);
      window.location.reload();
      return;
    }
    alert(message);
  };

  const markSubmissionStart = () => {
    setSubmissionStartedAt(Date.now());
  };

  const ensureMicrophonePermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!window.isSecureContext) {
      const host = window.location.hostname;
      const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host);
      setVoiceHint(
        isLocalHost
          ? '本地调试请直接用 http://localhost:3010 打开；如果你现在是局域网 IP，麦克风会被浏览器拦掉。'
          : `当前地址 ${window.location.origin} 不是安全上下文；麦克风只在 HTTPS 或 localhost 下可用。`,
      );
      return false;
    }
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      setVoiceHint('当前浏览器不支持麦克风调用，请直接键盘输入。');
      return false;
    }
    if (voicePermission === 'granted') return true;
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setVoicePermission('granted');
      setVoiceHint('麦克风已授权，可直接语音输入。');
      return true;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setVoicePermission('denied');
        setVoiceHint('麦克风权限未开启，请在浏览器设置中允许后重试。');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setVoiceHint('未检测到可用麦克风设备。');
      } else {
        setVoiceHint('麦克风初始化失败，请稍后重试或改用键盘输入。');
      }
      return false;
    }
  };

  const startSpeechInput = async (targetId: number) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSaveMessage('当前浏览器不支持语音输入，请直接键盘输入');
      focusQuestionTextarea();
      return;
    }
    if (recordingTarget === targetId) {
      stopSpeechInput();
      return;
    }
    if (recordingTarget) stopSpeechInput();

    const permissionOk = await ensureMicrophonePermission();
    if (!permissionOk) {
      focusQuestionTextarea();
      return;
    }

    try {
      const rec = new SR();
      speechRef.current = rec;
      setRecordingTarget(targetId);
      setSaveMessage('正在语音输入…再次点击麦克风可停止');
      setVoiceHint('正在收听中，请自然说话；再次点击可停止。');
      rec.lang = 'zh-CN';
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const t = e?.results?.[e.results.length - 1]?.[0]?.transcript ?? '';
        appendRecognizedText(targetId, String(t));
      };
      rec.onerror = (e: any) => {
        const code = String(e?.error || '');
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setSaveMessage('麦克风权限未开启，请允许后重试，或直接键盘输入');
          setVoicePermission('denied');
          setVoiceHint('浏览器拒绝了麦克风权限，请手动开启后重试。');
        } else if (code === 'no-speech' || code === 'audio-capture') {
          setSaveMessage('没有识别到语音，请靠近麦克风后重试');
          setVoiceHint('没有识别到语音，请确认麦克风正常并重新尝试。');
        } else if (code === 'network') {
          setSaveMessage('语音服务连接失败，请稍后重试');
          setVoiceHint('语音服务连接失败，请稍后重试或改用键盘输入。');
        } else {
          setSaveMessage('语音识别失败，请重试或直接键盘输入');
          setVoiceHint('语音识别失败，请重试或直接键盘输入。');
        }
        setRecordingTarget(null);
        speechRef.current = null;
      };
      rec.onend = () => {
        setRecordingTarget(null);
        speechRef.current = null;
        setVoiceHint('语音输入已结束，内容已追加到输入框。');
      };
      rec.start();
    } catch {
      setSaveMessage('语音输入启动失败，请直接键盘输入');
      setVoiceHint('语音输入启动失败，请直接键盘输入。');
      setRecordingTarget(null);
      speechRef.current = null;
    }
  };

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
      persistUserSnapshot(data.user);
      setStep(0);
    } else {
      alert(data.error);
    }
  };

  const getSlotMax = (slot: UploadSlot) => (slot === 'moments' ? 5 : 10);
  const getSlotLabel = (slot: UploadSlot) => (slot === 'moments' ? '朋友圈截图' : '生活照片');
  const getSlotCount = (slot: UploadSlot) => (
    slot === 'moments' ? momentsUploads.length : lifePhotoUploads.length
  );
  const appendSlotUpload = (slot: UploadSlot, item: StepUploadItem) => {
    if (slot === 'moments') setMomentsUploads((prev) => [...prev, item]);
    else setLifePhotoUploads((prev) => [...prev, item]);
  };

  const uploadScreenshotFiles = async (files: File[], slot: UploadSlot) => {
    if (!files.length) return;
    if (uploadingSlot) return;

    const max = getSlotMax(slot);
    const current = getSlotCount(slot);
    const remaining = max - current;
    if (remaining <= 0) {
      setSaveMessage(`${getSlotLabel(slot)}最多上传 ${max} 张`);
      return;
    }

    const queue = files.slice(0, remaining);
    if (files.length > remaining) {
      setSaveMessage(`${getSlotLabel(slot)}最多 ${max} 张，已按上限上传`);
    } else {
      setSaveMessage(null);
    }

    setUploadingSlot(slot);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < queue.length; i += 1) {
      const file = queue[i];
      setStepUploadProgress(Math.max(5, Math.round((i / queue.length) * 90)));

      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'screenshot');
      const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json().catch(() => ({} as { error?: string; upload?: { id?: string; url?: string } }));

      if (res.ok && data.upload?.id && data.upload?.url) {
        appendSlotUpload(slot, { id: data.upload.id, url: data.upload.url });
        successCount += 1;
      } else {
        failedCount += 1;
        const err = data.error ?? '';
        if (err === '登录态已失效，请重新登录' || err === '未登录' || err === '无效Token') {
          await recoverExpiredSession('登录态已失效，正在重建会话…');
          setUploadingSlot(null);
          setStepUploadProgress(0);
          return;
        }
        alert(err || '保存失败，请重试');
      }
    }

    if (successCount > 0) {
      setStepUploadProgress(100);
      setSaveMessage(
        failedCount > 0
          ? `已上传 ${successCount} 张，${failedCount} 张失败`
          : `已上传 ${successCount} 张，支持继续添加`,
      );
      setTimeout(() => setStepUploadProgress(0), 450);
    } else {
      setStepUploadProgress(0);
    }

    setUploadingSlot(null);
  };

  const removeUploadedScreenshot = async (slot: UploadSlot, uploadId: string) => {
    setStepUploadProgress(30);
    const res = await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ uploadId }),
    });
    const data = await res.json().catch(() => ({} as { error?: string }));
    if (!res.ok) {
      const err = data.error ?? '';
      if (err === '登录态已失效，请重新登录' || err === '未登录' || err === '无效Token') {
        await recoverExpiredSession('登录态已失效，正在重建会话…');
        return;
      }
      alert(err || '删除失败，请稍后重试');
      setStepUploadProgress(0);
      return;
    }

    if (slot === 'moments') {
      setMomentsUploads((prev) => prev.filter((item) => item.id !== uploadId));
    } else {
      setLifePhotoUploads((prev) => prev.filter((item) => item.id !== uploadId));
    }
    setStepUploadProgress(100);
    setSaveMessage('已删除');
    setTimeout(() => setStepUploadProgress(0), 300);
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
      if (err === '登录态已失效，请重新登录' || err === '未登录' || err === '无效Token') {
        await recoverExpiredSession('登录态已失效，正在重建会话…');
        return false;
      }
      const hint = err === '未登录' || err === '无效Token'
        ? '登录状态已失效，请刷新后重新登录。'
        : (err || '保存失败');
      alert(hint);
      setStepUploadProgress(0);
      return false;
    }
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSaveMessage(successMessage);
    } catch {
      setSaveMessage('复制失败，请手动长按或选中复制');
    }
  };

  const updateQuestionAnswer = (questionId: number, value: QuestionnaireAnswer) => {
    if (debugPrefilledReady) setDebugPrefilledReady(false);
    setQuestionAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleTagAnswer = (questionId: number, tag: string) => {
    if (debugPrefilledReady) setDebugPrefilledReady(false);
    setQuestionAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? ([...prev[questionId]] as string[]) : [];
      const exists = current.includes(tag);
      if (exists) return { ...prev, [questionId]: current.filter((item) => item !== tag) };
      if (current.length >= 3) return prev;
      return { ...prev, [questionId]: [...current, tag] };
    });
  };

  const validateQuestion = (question: QuestionnaireQuestion, answer: QuestionnaireAnswer | undefined) => {
    if (!question.required && (answer === undefined || answer === null || answer === '')) return null;
    if (question.type === 'profile') {
      const profile = (answer || {}) as ProfileAnswer;
      if (!profile.nickname?.trim()) return '请填写昵称';
      return null;
    }
    if (question.type === 'range') {
      const range = (answer || {}) as HeightPreferenceAnswer;
      if (typeof range.myHeight !== 'number') return '请先选择你的身高';
      if (typeof range.preferredMin !== 'number' || typeof range.preferredMax !== 'number') return '请先选择期望身高范围';
      if (range.preferredMin > range.preferredMax) return '期望身高下限不能高于上限';
      return null;
    }
    if (question.type === 'tags') {
      const tags = Array.isArray(answer) ? (answer as string[]) : [];
      if (tags.length !== 3) return '请严格选择 3 个标签';
      return null;
    }
    if (question.type === 'scale') {
      if (typeof answer !== 'number') {
        if (question.required) return '请选择 1-7 的分值';
        return null;
      }
      return null;
    }
    if (typeof answer !== 'string' || !answer.trim()) return '请先填写当前问题';
    return null;
  };

  const formatAnswer = (question: QuestionnaireQuestion, answer: QuestionnaireAnswer | undefined): string => {
    if (answer === undefined || answer === null || answer === '') return '（未填写）';
    if (question.type === 'profile') {
      const profile = answer as ProfileAnswer;
      return `昵称：${profile.nickname || '未填'}；性别：${profile.gender || '未填写'}；生日：${profile.birthday || '未填写'}`;
    }
    if (question.type === 'range') {
      const range = answer as HeightPreferenceAnswer;
      return `我的身高：${range.myHeight || '未填'}cm；期望范围：${range.preferredMin || '未填'}-${range.preferredMax || '未填'}cm`;
    }
    if (question.type === 'tags') {
      const tags = Array.isArray(answer) ? (answer as string[]) : [];
      return tags.length ? tags.join(' / ') : '（未填写）';
    }
    if (question.type === 'scale') return `${answer} 分`;
    return String(answer);
  };

  const hasMeaningfulAnswer = (question: QuestionnaireQuestion, answer: QuestionnaireAnswer | undefined) => {
    if (answer === undefined || answer === null) return false;
    if (question.type === 'profile') {
      const profile = answer as ProfileAnswer;
      return Boolean(profile.nickname?.trim() && profile.gender?.trim() && profile.birthday?.trim());
    }
    if (question.type === 'range') {
      const range = answer as HeightPreferenceAnswer;
      return typeof range.myHeight === 'number'
        && typeof range.preferredMin === 'number'
        && typeof range.preferredMax === 'number';
    }
    if (question.type === 'tags') {
      return Array.isArray(answer) && answer.length === 3;
    }
    if (question.type === 'scale') {
      return typeof answer === 'number';
    }
    if (typeof answer === 'string') return Boolean(answer.trim());
    return false;
  };

  const submitFullQuestionnaire = async () => {
    const summary = QUESTIONNAIRE.map((question) => {
      const answer = questionAnswers[question.id];
      return `Q${question.id}【${question.title}】${question.prompt}\n答：${formatAnswer(question, answer)}`;
    }).join('\n\n');

    const openTextSummary = QUESTIONNAIRE
      .filter((question) => question.type === 'text')
      .map((question) => `Q${question.id}：${formatAnswer(question, questionAnswers[question.id])}`)
      .join('\n');

    const payload: QuestionnaireSubmissionPayload = {
      questionnaireSummary: summary.trim(),
      openTextSummary: openTextSummary.trim(),
      matchIntentText: matchIntent.trim(),
    };
    setStepUploadProgress(100);
    setSaveMessage('已整理当前问卷内容，开始生成灵魂档案');
    setTimeout(() => setStepUploadProgress(0), 300);
    startAnalysis(payload);
  };

  const submitQuestionStep = async () => {
    if (debugPrefilledReady) setDebugPrefilledReady(false);
    stopSpeechInput();
    const currentQuestion = QUESTIONNAIRE[questionIndex];
    if (!currentQuestion) return;
    const answer = questionAnswers[currentQuestion.id];
    const validationError = validateQuestion(currentQuestion, answer);
    if (validationError) {
      setSaveMessage(validationError);
      if (currentQuestion.type === 'text') setTimeout(() => focusQuestionTextarea(), 0);
      return;
    }

    if (currentQuestion.id === 4 && typeof answer === 'string') {
      setMatchIntent(answer);
    }
    const nextIndex = questionIndex + 1;
    const finished = nextIndex >= QUESTIONNAIRE.length;
    if (finished) {
      await submitFullQuestionnaire();
      return;
    }
    setQuestionIndex(nextIndex);
    setSaveMessage(`已记录第 ${currentQuestion.id} 题，继续下一题`);
  };

  submitQuestionStepRef.current = submitQuestionStep;

  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    const autoAdvanceQuestion = QUESTIONNAIRE[Math.min(questionIndex, QUESTIONNAIRE.length - 1)];
    if (step !== 4 || !autoAdvanceQuestion || stepUploadProgress > 0) return;
    if (debugPrefilledReady) return;
    if (recordingTarget === autoAdvanceQuestion.id) return;
    if (autoAdvanceQuestion.type === 'range') return;

    const answer = questionAnswers[autoAdvanceQuestion.id];
    if (!hasMeaningfulAnswer(autoAdvanceQuestion, answer)) {
      autoAdvanceQuestionRef.current = null;
      return;
    }

    const validationError = validateQuestion(autoAdvanceQuestion, answer);
    if (validationError) {
      autoAdvanceQuestionRef.current = null;
      return;
    }

    if (autoAdvanceQuestionRef.current === autoAdvanceQuestion.id) return;

    const delay = autoAdvanceQuestion.type === 'text'
      ? 1100
      : autoAdvanceQuestion.type === 'profile'
        ? 700
        : autoAdvanceQuestion.type === 'tags'
          ? 420
          : 260;

    autoAdvanceTimerRef.current = setTimeout(() => {
      autoAdvanceQuestionRef.current = autoAdvanceQuestion.id;
      void submitQuestionStepRef.current();
    }, delay);

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [debugPrefilledReady, questionAnswers, questionIndex, recordingTarget, step, stepUploadProgress]);

  const persistPlatformBinding = async (platformId: PlatformKey, rawInput?: string) => {
    const raw = rawInput ?? bindings[platformId];
    const resolved = resolvePlatformUrl(platformId, raw);
    if (resolved.ok === false) {
      return { ok: false as const, error: resolved.error };
    }

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
      setSavedPlatforms((prev) => ({ ...prev, [platformId]: resolved.url }));
      return { ok: true as const, url: resolved.url };
    } else {
      const err = data.error ?? '';
      if (err === '登录态已失效，请重新登录' || err === '未登录' || err === '无效Token') {
        await recoverExpiredSession('登录态已失效，正在重建会话…');
        return { ok: false as const, error: 'auth-expired' };
      }
      return { ok: false as const, error: err || '绑定失败' };
    }
  };

  const bindPlatform = async (platformId: PlatformKey) => {
    setSaveMessage(null);
    setStepUploadProgress(25);
    const result = await persistPlatformBinding(platformId);
    if (result.ok) {
      setStepUploadProgress(100);
      setBindings((b) => ({ ...b, [platformId]: '' }));
      setActiveInput(null);
      setSaveMessage(`${PLATFORM_NAMES[platformId]} 已关联`);
      setTimeout(() => setStepUploadProgress(0), 400);
      if (!debugMode) alert(`${PLATFORM_NAMES[platformId]} 绑定成功`);
      return;
    }
    const hint = result.error === 'auth-expired'
      ? '登录状态已失效，请刷新后重新登录。'
      : (result.error || '绑定失败');
    alert(hint);
    setStepUploadProgress(0);
  };

  // Debug 模式：自动绑定所有平台
  const autoBindAllPlatforms = async (options?: { jumpToQuestionnaire?: boolean }) => {
    if (!debugMode) return;
    if (!submissionStartedAt) markSubmissionStart();
    console.log('[Debug] 开始自动绑定所有平台...');
    for (const platformId of ACTIVE_PLATFORM_KEYS) {
      const raw = DEBUG_PLATFORM_DEFAULTS[platformId];
      const resolved = resolvePlatformUrl(platformId, raw);
      if (!resolved.ok) continue;

      try {
        const result = await persistPlatformBinding(platformId, raw);
        if (result.ok) {
          console.log(`[Debug] ${PLATFORM_NAMES[platformId]} 绑定成功`);
        } else if (result.error === 'auth-expired') {
          await recoverExpiredSession('登录态已失效，正在重建 Debug 会话…');
          return;
        } else if (result.error) {
          console.error(`[Debug] ${PLATFORM_NAMES[platformId]} 绑定失败: ${result.error}`);
        }
      } catch (err) {
        console.error(`[Debug] ${PLATFORM_NAMES[platformId]} 绑定失败:`, err);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log('[Debug] 所有平台绑定完成');
    if (options?.jumpToQuestionnaire) {
      setActiveInput(null);
      setQuestionIndex(QUESTIONNAIRE.length - 1);
      setDebugPrefilledReady(true);
      setSaveMessage('Debug 预填完成，可直接点击「生成灵魂档案」');
      setStep(4);
    }
  };

  const syncPendingPlatformsBeforeAnalyze = async () => {
    const pending = ACTIVE_PLATFORM_KEYS.filter((platformId) => {
      if (savedPlatforms[platformId]) return false;
      const raw = bindings[platformId]?.trim();
      if (!raw) return false;
      return resolvePlatformUrl(platformId, raw).ok;
    });
    if (pending.length === 0) return;
    setSaveMessage(`正在同步 ${pending.length} 个已填写的平台…`);
    for (const platformId of pending) {
      const result = await persistPlatformBinding(platformId, bindings[platformId]);
      if (!result.ok && result.error && result.error !== 'auth-expired') {
        console.error(`[Analyze] ${PLATFORM_NAMES[platformId]} 分析前同步失败: ${result.error}`);
      }
      if (!result.ok && result.error === 'auth-expired') return;
    }
  };

  const startAnalysis = async (questionnairePayload?: QuestionnaireSubmissionPayload) => {
    const effectiveSubmissionStartedAt = submissionStartedAt ?? Date.now();
    if (!submissionStartedAt) setSubmissionStartedAt(effectiveSubmissionStartedAt);
    await syncPendingPlatformsBeforeAnalyze();
    if (debugMode && Object.values(savedPlatforms).filter(Boolean).length === 0) {
      setSaveMessage('Debug 模式：正在自动补齐平台绑定…');
      await autoBindAllPlatforms();
    }
    setDebugPrefilledReady(false);
    setStep(6);
    setAnalysisStage('queued');
    setStageTimeline([]);
    setAnalysisSnapshot({});
    setAnalysisStatus(ANALYZE_STAGE_META.queued.label);
    try {
      setUserScreenshotUrls([]);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionStartedAt: effectiveSubmissionStartedAt,
          questionnaireSummary: questionnairePayload?.questionnaireSummary || '',
          openTextSummary: questionnairePayload?.openTextSummary || '',
          matchIntentText: questionnairePayload?.matchIntentText || '',
        }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('ndjson')) {
        const data = await readAnalyzeNdjsonStreamWithEvents(res, {
          onStage: (event) => {
            setAnalysisStage(event.stage);
            setAnalysisStatus(event.message || ANALYZE_STAGE_META[event.stage].label);
          },
          onStageDuration: (event) => {
            setStageTimeline((prev) => [...prev, { ...event, timestamp: Date.now() }]);
            setStageStats((prev) => ({ ...prev, [event.stage]: event.aggregated }));
          },
          onSnapshot: (event) => {
            setAnalysisSnapshot(event.snapshot);
          },
        });
        setAnalysisStage('done');
        setAnalysisResult(
          data.report
            ? { ...(data.report as Record<string, unknown>), mbtiIp: data.mbtiIp ?? null }
            : data.report,
        );
        setUserScreenshotUrls(data.userScreenshotUrls);
        setStep(7);
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          report?: unknown;
          userScreenshotUrls?: string[];
          mbtiIp?: unknown;
        };
        if (res.ok && data.report) {
          setAnalysisStage('done');
          setAnalysisResult(
            data.report
              ? { ...(data.report as Record<string, unknown>), mbtiIp: data.mbtiIp ?? null }
              : data.report,
          );
          setUserScreenshotUrls(Array.isArray(data.userScreenshotUrls) ? data.userScreenshotUrls : []);
          setStep(7);
        } else {
          if (data.error === '登录态已失效，请重新登录' || data.error === '未登录' || data.error === '无效Token') {
            await recoverExpiredSession('登录态已失效，正在重建会话…');
            return;
          }
          alert('分析失败: ' + (data.error || `请求错误 (${res.status})`));
          setStep(3);
        }
      }
    } catch (e) {
      const st = (e as Error & { status?: number }).status;
      const msg = e instanceof Error ? e.message : '网络错误';
      if (st === 409) {
        // 409 表示已有分析在进行中，保持在分析页面等待完成，不要回退
        setAnalysisStatus('检测到正在进行的分析任务，请稍候…');
      } else {
        alert(`网络错误：${msg}`);
        setStep(3);
      }
    } finally {
      setQuestionIndex(0);
    }
  };

  const questionButtonLabel = stepUploadProgress > 0
    ? '保存中…'
    : questionIndex >= QUESTIONNAIRE.length - 1
      ? '生成灵魂档案 →'
      : '继续下一题 →';

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
              <PrivacyNavLink>
                查看详细数据获取范围 &gt;
              </PrivacyNavLink>
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
      <div className="platform-row-wrapper" key={id}>
        <div className={`platform-item ${isBound ? 'connected' : ''}`} onClick={() => setActiveInput(isActive ? null : id)}>
          <div className="p-icon" style={{ background: bg, color: color }}>{iconStr}</div>
          <div className="p-info">{name}</div>
          <div className="p-status">{isBound ? '已绑定' : '未绑定'}</div>
        </div>

        {persisted && (
          <p className="platform-hint">
            主页链接：<a href={persisted} target="_blank" rel="noopener noreferrer" className="platform-link">{persisted}</a>
          </p>
        )}

        {isActive && (
          <div className="tutorial-container">
            <p className="tutorial-title">
              📋 如何获取你自己的链接
            </p>

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
            <div className="ref-platform-actions">
              <button
                type="button"
                className="btn btn-secondary ref-inline-action"
                onClick={() => setTutorialPlatform(id)}
              >
                查看示例教程
              </button>
            </div>
            <button type="button" className="btn btn-primary btn-confirm-binding" disabled={!!validation && !validation.ok} onClick={() => bindPlatform(id)}>
              确认绑定
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderUploadSection = (slot: UploadSlot, title: string, desc: string, icon: string) => {
    const uploads = slot === 'moments' ? momentsUploads : lifePhotoUploads;
    const max = getSlotMax(slot);
    const uploading = uploadingSlot === slot;

    return (
      <div className="ref-step-panel">
        <UploadSection
          slot={slot}
          title={title}
          desc={desc}
          icon={icon}
          uploads={uploads}
          maxFiles={max}
          isUploading={uploading}
          onUpload={(uploadSlot, files) => {
            void uploadScreenshotFiles(files, uploadSlot);
          }}
          onRemove={(uploadSlot, fileId) => {
            void removeUploadedScreenshot(uploadSlot, fileId);
          }}
        />
        <div className="ref-upload-footnote">
          <span className="ref-upload-footnote-dot" aria-hidden />
          这些素材只会用于生成你的档案和报告海报，删除后会同步从当前建档记录移除。
        </div>
      </div>
    );
  };

  /** 设计稿：阶段 1/4→25% … 4/4→100% */
  const progressPercent = (() => {
    if (step === 1) return Math.round((1 / TOTAL_ONBOARD_STEPS) * 100);
    if (step === 2) return Math.round((2 / TOTAL_ONBOARD_STEPS) * 100);
    if (step === 3) return Math.round((3 / TOTAL_ONBOARD_STEPS) * 100);
    if (step === 4) {
      const answeredRatio = Math.max(0, Math.min(1, questionIndex / QUESTIONNAIRE.length));
      return Math.min(100, Math.round(((3 + answeredRatio) / TOTAL_ONBOARD_STEPS) * 100));
    }
    return 0;
  })();
  /** 了解程度心形：与进度条保持一致 */
  const familiarityPercent = progressPercent;
  const answeredCount = Math.max(0, Math.min(questionIndex, QUESTIONNAIRE.length));
  const answeredQuestions = QUESTIONNAIRE.slice(0, questionIndex);
  const currentQuestion = QUESTIONNAIRE[Math.min(questionIndex, QUESTIONNAIRE.length - 1)];
  const currentAnswer = currentQuestion ? questionAnswers[currentQuestion.id] : undefined;
  const isCurrentTextQuestion = Boolean(currentQuestion && currentQuestion.type === 'text');

  const renderQuestionInput = (question: QuestionnaireQuestion, answer: QuestionnaireAnswer | undefined, readonly = false) => {
    if (readonly) {
      return <p className="ref-q-answer">{formatAnswer(question, answer)}</p>;
    }

    if (question.type === 'profile') {
      const profile = (answer || { nickname: '', gender: '', birthday: '' }) as ProfileAnswer;
      return (
        <div className="ref-q-grid">
          <input
            type="text"
            className="glass-input ref-q-input"
            placeholder="昵称"
            value={profile.nickname || ''}
            onChange={(e) => updateQuestionAnswer(question.id, { ...profile, nickname: e.target.value })}
          />
          <select
            className="glass-input ref-q-input"
            value={profile.gender || ''}
            onChange={(e) => updateQuestionAnswer(question.id, { ...profile, gender: e.target.value })}
          >
            <option value="">选择性别</option>
            <option value="男">男</option>
            <option value="女">女</option>
            <option value="其他">其他</option>
            <option value="不方便透露">不方便透露</option>
          </select>
          <input
            type="date"
            className="glass-input ref-q-input"
            value={profile.birthday || ''}
            onChange={(e) => updateQuestionAnswer(question.id, { ...profile, birthday: e.target.value })}
          />
        </div>
      );
    }

    if (question.type === 'range') {
      const range = (answer || { myHeight: 172, preferredMin: 165, preferredMax: 182 }) as HeightPreferenceAnswer;
      const myHeight = typeof range.myHeight === 'number' ? range.myHeight : 172;
      const preferredMin = typeof range.preferredMin === 'number' ? range.preferredMin : 165;
      const preferredMax = typeof range.preferredMax === 'number' ? range.preferredMax : 182;
      return (
        <div className="ref-range-wrap">
          <div className="ref-range-label">我的身高：{myHeight}cm</div>
          <input
            type="range"
            min={140}
            max={210}
            step={1}
            value={myHeight}
            className="ref-height-range"
            onChange={(e) => updateQuestionAnswer(question.id, { ...range, myHeight: Number(e.target.value) })}
          />
          <div className="ref-range-label">期望对方身高：{preferredMin}cm - {preferredMax}cm</div>
          <input
            type="range"
            min={140}
            max={210}
            step={1}
            value={preferredMin}
            className="ref-height-range"
            onChange={(e) => {
              const val = Number(e.target.value);
              updateQuestionAnswer(question.id, { ...range, preferredMin: Math.min(val, preferredMax), preferredMax });
            }}
          />
          <input
            type="range"
            min={140}
            max={210}
            step={1}
            value={preferredMax}
            className="ref-height-range"
            onChange={(e) => {
              const val = Number(e.target.value);
              updateQuestionAnswer(question.id, { ...range, preferredMin, preferredMax: Math.max(val, preferredMin) });
            }}
          />
        </div>
      );
    }

    if (question.type === 'single') {
      const value = typeof answer === 'string' ? answer : '';
      return (
        <div className="ref-choice-grid">
          {(question.options || []).map((option) => (
            <button
              key={option}
              type="button"
              className={`ref-choice-btn${value === option ? ' active' : ''}`}
              onClick={() => updateQuestionAnswer(question.id, option)}
            >
              {option}
            </button>
          ))}
        </div>
      );
    }

    if (question.type === 'tags') {
      const values = Array.isArray(answer) ? (answer as string[]) : [];
      return (
        <>
          <div className="ref-choice-grid ref-choice-grid-tags">
            {(question.options || []).map((option) => (
              <button
                key={option}
                type="button"
                className={`ref-choice-btn ref-choice-tag${values.includes(option) ? ' active' : ''}`}
                onClick={() => toggleTagAnswer(question.id, option)}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="ref-q-tag-hint">已选 {values.length}/3</p>
        </>
      );
    }

    if (question.type === 'scale') {
      const value = typeof answer === 'number' ? answer : 0;
      return (
        <div className="ref-scale-wrap">
          <div className="ref-scale-grid">
            {SCALE_OPTIONS.map((num) => (
              <button
                key={num}
                type="button"
                className={`ref-scale-btn${value === num ? ' active' : ''}`}
                onClick={() => updateQuestionAnswer(question.id, num)}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="ref-scale-labels">
            <span>{question.scaleLeft || '1'}</span>
            <span>{question.scaleRight || '7'}</span>
          </div>
        </div>
      );
    }

    const value = typeof answer === 'string' ? answer : '';
    return (
      <textarea
        ref={activeTextareaRef}
        className="glass-input ref-chat-textarea"
        placeholder={question.placeholder || '请输入你的回答'}
        rows={4}
        value={value}
        onChange={(e) => updateQuestionAnswer(question.id, e.target.value)}
      />
    );
  };

  const bindingCount = Object.values(savedPlatforms).filter(Boolean).length;
  const screenshotCount = momentsUploads.length + lifePhotoUploads.length;
  const snapshotSubmission = analysisSnapshot.submission;
  const snapshotScrape = analysisSnapshot.scrape;
  const snapshotVision = analysisSnapshot.vision;
  const snapshotOutput = analysisSnapshot.output;
  const displayPlatformCount = snapshotSubmission?.platformBindings ?? bindingCount;
  const displayScreenshotCount = snapshotSubmission?.userScreenshots ?? screenshotCount;
  const displayTextCount = snapshotSubmission?.textEntries ?? 0;

  const analyzeChecklist = [
    { key: 'gathering', label: '整理建档素材' },
    { key: 'scraping', label: '抓取平台公开线索' },
    { key: 'vision', label: '分析截图与视觉信息' },
    { key: 'prompting', label: '生成画像与匹配建议' },
    { key: 'saving', label: '整理并保存完整报告' },
  ] as const;
  const currentStagePercent = ANALYZE_STAGE_META[analysisStage].percent;

  const deriveStageEta = (stage: AnalyzeStageKey) => {
    if (stage === 'scraping') {
      const min = 20 + displayPlatformCount * 4;
      const max = min + 25;
      return `预计 ${min}-${max} 秒（本次识别到 ${displayPlatformCount} 个平台）`;
    }
    if (stage === 'vision') {
      const min = 18 + Math.ceil(displayScreenshotCount / 2) * 3;
      const max = min + 22;
      return `预计 ${min}-${max} 秒（正在处理 ${displayScreenshotCount} 张截图）`;
    }
    if (stage === 'prompting') {
      const min = displayPlatformCount >= 4 ? 18 : 12;
      const max = min + 15;
      return `预计 ${min}-${max} 秒（AI 需整合 ${displayPlatformCount} 个平台）`;
    }
    return ANALYZE_STAGE_META[stage].eta;
  };

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
          <div className="progress-bar-fill" style={{ width: `${stepUploadProgress}%` }} />
        </div>
      )}

      <div className="bg-gradient"></div><div className="glow-orb orb-1"></div><div className="glow-orb orb-2"></div>

      <div
        ref={viewContainerRef}
        className={`view-container${step >= 1 && step <= TOTAL_ONBOARD_STEPS ? ' view-container-step' : ''}`}
      >
        {step === 0 && (
          <div className="view-content view-home ref-home-screen">
            <div className="ref-home-top">
              <div className="ref-home-badge">SoulMatch Persona Studio</div>
              <div className="hero-icon-container ref-home-orbit">
                <div className="hero-icon ref-home-sparkle" aria-hidden>✦</div>
                <div className="ref-home-orbit-ring ring-one" aria-hidden />
                <div className="ref-home-orbit-ring ring-two" aria-hidden />
              </div>
              <h1 className="title ref-home-title">把公开痕迹<br />整理成你的数字分身</h1>
              <p className="ref-home-welcome">欢迎，{user?.name ?? '朋友'}</p>
              <p className="ref-home-lead">
                不靠空泛标签，直接用截图、公开主页和关系问卷，生成一份更像真人的灵魂档案。
              </p>
            </div>

            <div className="ref-home-stat-grid">
              {HOME_HIGHLIGHTS.map((item) => (
                <div key={item.label} className="ref-home-stat-card">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="ref-home-cards ref-home-cards-wide">
              {HOME_FLOW.map((item, index) => (
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
              <button
                type="button"
                className="btn btn-primary btn-glow"
                onClick={() => {
                  markSubmissionStart();
                  setStep(1);
                }}
              >
                开始建档
              </button>
            </div>
          </div>
        )}

        {step >= 1 && step <= TOTAL_ONBOARD_STEPS && (
          <div className="view-content view-step ref-step-shell">
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
              <div className="ref-progress-topline">
                <div className="ref-progress-meta">
                  <div className="ref-progress-row">
                    <span>建档总进度</span>
                    <span>{progressPercent}%</span>
                  </div>
                  {step === 4 && (
                    <p className="ref-progress-hint">问卷进度：已回答 {answeredCount} / {QUESTIONNAIRE.length} 题</p>
                  )}
                  {saveMessage && <p className="ref-progress-hint">{saveMessage}</p>}
                </div>
                <FamiliarityHeart pct={familiarityPercent} />
              </div>
              <div className="ref-progress-track">
                <div className="ref-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="ref-step-intro-card">
              <p className="ref-step-intro-kicker">{STEP_INTRO[step].kicker}</p>
              <h2>{STEP_INTRO[step].title}</h2>
              <p>{STEP_INTRO[step].desc}</p>
            </div>

            {step === 1 && (
              <div className="step-body ref-step1-body">
                {debugMode && (
                  <button
                    type="button"
                    className="btn btn-secondary debug-skip-btn"
                    onClick={() => setStep(4)}
                  >
                    🚀 Debug: 跳到问卷
                  </button>
                )}
                {renderUploadSection('moments', '上传朋友圈截图', '可多选上传，最多 5 张；也可跳过。', '📸')}

                <div className="bottom-action ref-step-bottom-action">
                  <button type="button" className="btn btn-primary btn-glow" onClick={() => setStep(2)}>
                    下一步 →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="step-body ref-step1-body">
                {debugMode && (
                  <button
                    type="button"
                    className="btn btn-secondary debug-skip-btn"
                    onClick={() => setStep(4)}
                  >
                    🚀 Debug: 跳到问卷
                  </button>
                )}
                {renderUploadSection('life', '上传最近生活照片', '支持多选，最多 10 张。', '🖼')}

                <div className="bottom-action ref-step-bottom-action">
                  <button type="button" className="btn btn-primary btn-glow" onClick={() => setStep(3)}>
                    下一步 →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="step-body">
                {debugMode && (
                  <button
                    type="button"
                    className="btn btn-secondary debug-skip-btn"
                    onClick={() => setStep(4)}
                  >
                    🚀 Debug: 跳到问卷
                  </button>
                )}
                <h2 className="step-title ref-platform-main-title">
                  社交平台（仅获取公开数据，用来创建分身）
                </h2>
                <p className="ref-platform-yellow">
                  通过你填写的本人社交账号，创建独一无二的你的专属数字分身，绑定越多你的分身将越像你。所有数据均在此平台你本人使用，随时可解绑，无隐私风险。
                </p>
                <div className="ref-platform-summary">
                  <div className="ref-platform-summary-card">
                    <strong>{bindingCount}</strong>
                    <span>已绑定平台</span>
                  </div>
                  <div className="ref-platform-summary-card">
                    <strong>{ACTIVE_PLATFORM_KEYS.length}</strong>
                    <span>当前可接入平台</span>
                  </div>
                  <div className="ref-platform-summary-card">
                    <strong>公开</strong>
                    <span>仅读取主页公开信息</span>
                  </div>
                </div>
                <div className="platform-list">
                  {XHS_BINDING_ENABLED ? renderPlatformRow('xhs', PLATFORM_NAMES.xhs, '📕', '#FFE6E6', '#FF2442') : null}
                  {renderPlatformRow('weibo', PLATFORM_NAMES.weibo, '👀', '#FFF0E6', '#FF8200')}
                  {renderPlatformRow('douyin', PLATFORM_NAMES.douyin, '🎵', '#2C2C2E', '#FFFFFF')}
                  {renderPlatformRow('netease', PLATFORM_NAMES.netease, '🎵', '#FFEAEA', '#E60026')}
                  {renderPlatformRow('douban', PLATFORM_NAMES.douban, '🎬', '#E6F7EA', '#00B51D')}
                  {renderPlatformRow('zhihu', PLATFORM_NAMES.zhihu, '💡', '#E6F0FF', '#0066FF')}
                </div>
                {!XHS_BINDING_ENABLED && (
                  <p className="platform-warning">
                    小红书入口已暂时关闭，后续恢复后会重新开放。
                  </p>
                )}
                <div className="bottom-action ref-platform-bottom-action">
                  <button type="button" className="btn btn-primary btn-glow" onClick={() => setStep(4)}>
                    下一步 →
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="step-body ref-chat-step">
                <h2 className="ref-chat-h1">让我更了解你吧</h2>
                <p className="ref-chat-sub">填写完成后会自动展开下一题，底部按钮仅作兜底。</p>
                <div className="ref-stage-pill ref-chat-stage-pill">
                  问题 {Math.min(questionIndex + 1, QUESTIONNAIRE.length)} / {QUESTIONNAIRE.length}
                </div>

                {debugMode && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginBottom: '16px' }}
                    onClick={() => void submitFullQuestionnaire()}
                  >
                    🚀 Debug: 跳过问卷直接生成
                  </button>
                )}

                <div className="ref-question-flow">
                  {answeredQuestions.map((question) => (
                    <div key={question.id} className="ref-question-card answered">
                      <div className="ref-chat-row">
                        <div className="ref-chat-avatar" aria-hidden>✓</div>
                        <div className="ref-chat-bubble">
                          <div className="ref-bubble-title">Q{question.id} · {question.title}</div>
                          <div className="ref-bubble-body">{question.prompt}</div>
                        </div>
                      </div>
                      {renderQuestionInput(question, questionAnswers[question.id], true)}
                    </div>
                  ))}

                  <div className="ref-question-card active">
                    <div className="ref-chat-row">
                      <div className="ref-chat-avatar" aria-hidden>🧙</div>
                      <div className="ref-chat-bubble">
                        <div className="ref-bubble-title">
                          Q{currentQuestion.id} · {currentQuestion.title}
                          {!currentQuestion.required && <span className="ref-q-optional">（选填）</span>}
                        </div>
                        <div className="ref-bubble-body">{currentQuestion.prompt}</div>
                      </div>
                    </div>
                    {renderQuestionInput(currentQuestion, currentAnswer)}
                    {currentQuestion.helper && <p className="ref-q-helper">{currentQuestion.helper}</p>}
                  </div>
                </div>

                {isCurrentTextQuestion && (
                  <div className="ref-chat-toolbar">
                    <button type="button" className="ref-chat-keyboard-btn" onClick={() => focusQuestionTextarea()}>
                      键盘输入
                    </button>
                    <button
                      type="button"
                      className="ref-chat-mic"
                      aria-label="语音输入"
                      aria-pressed={recordingTarget === currentQuestion.id}
                      onClick={() => void startSpeechInput(currentQuestion.id)}
                    >
                      {recordingTarget === currentQuestion.id ? '⏹' : '🎤'}
                    </button>
                  </div>
                )}
                {isCurrentTextQuestion && (
                  <div className="ref-chat-voice-hint">
                    {voiceSupported ? voiceHint : '当前浏览器暂不支持语音输入，请直接使用键盘。'}
                  </div>
                )}
                <div ref={questionFlowTailRef} />
                <div className="bottom-action ref-step-bottom-action">
                  {questionIndex > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        stopSpeechInput();
                        setQuestionIndex((prev) => Math.max(0, prev - 1));
                      }}
                    >
                      返回上一题
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-glow"
                    onClick={() => void submitQuestionStep()}
                  >
                    {questionButtonLabel}
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
            <p className="loading-status loading-status-text">{analysisStatus}</p>
            <div className="ref-loading-progress">
              <div className="ref-loading-progress-row">
                <span>当前进度</span>
                <span>{currentStagePercent}%</span>
              </div>
              <div className="ref-loading-progress-track">
                <div className="ref-loading-progress-fill" style={{ width: `${currentStagePercent}%` }} />
              </div>
              <p className="ref-loading-eta">{deriveStageEta(analysisStage)}</p>
            </div>
            <div className="ref-loading-stage-list">
              {analyzeChecklist.map(({ key, label }) => {
                const stageDone = ANALYZE_STAGE_META[analysisStage].percent > ANALYZE_STAGE_META[key].percent;
                const isCurrent = analysisStage === key;
                return (
                  <div
                    key={label}
                    className={`ref-loading-stage-item${stageDone ? ' done' : ''}${isCurrent ? ' current' : ''}`}
                  >
                    <span className="ref-loading-stage-icon">{stageDone ? '✓' : isCurrent ? '●' : '⋯'}</span>
                    <span>
                      {label}
                    <span className="ref-loading-stage-sub">
                      {key === 'scraping'
                        ? `本次识别到 ${displayPlatformCount} 个平台`
                        : key === 'vision'
                          ? `正在分析 ${displayScreenshotCount} 张截图`
                          : key === 'prompting'
                            ? `AI 整合 ${displayPlatformCount} 平台 + ${displayScreenshotCount} 张截图`
                            : null}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="ref-loading-facts">
            <div className="ref-loading-fact-card">
              <strong>本次提交</strong>
              <p>{snapshotSubmission ? `${snapshotSubmission.totalUploads} 条素材` : '等待后端确认素材清单'}</p>
              <span>平台 {displayPlatformCount} · 截图 {displayScreenshotCount} · 文字 {displayTextCount}</span>
            </div>
            <div className="ref-loading-fact-card">
              <strong>抓取结果</strong>
              <p>
                {snapshotScrape
                  ? `成功 ${snapshotScrape.succeededPlatforms} / ${snapshotScrape.requestedPlatforms}`
                  : '还没进入平台抓取'}
              </p>
              <span>
                {snapshotScrape
                  ? `失败 ${snapshotScrape.failedPlatforms} 个平台`
                  : '抓取后会显示公开主页命中情况'}
              </span>
            </div>
            <div className="ref-loading-fact-card">
              <strong>视觉分析</strong>
              <p>
                {snapshotVision
                  ? `送入模型 ${snapshotVision.selectedImages} 张`
                  : '还没进入截图分析'}
              </p>
              <span>
                {snapshotVision
                  ? `平台图 ${snapshotVision.platformImages} · 用户图 ${snapshotVision.userUploadImages}`
                  : '会区分平台截图和你手传的截图'}
              </span>
            </div>
            <div className="ref-loading-fact-card">
              <strong>输出来源</strong>
              <p>
                {snapshotOutput
                  ? snapshotOutput.source === 'openai'
                    ? `AI 模型 ${snapshotOutput.model || '已接入'}`
                    : snapshotOutput.source === 'cache'
                      ? '复用最近一次缓存结果'
                      : '使用兜底模板'
                  : '结果生成中'}
              </p>
              <span>
                {snapshotSubmission?.hasMatchIntent ? '已包含问卷中的交友偏好' : '未检测到交友偏好文本'}
              </span>
            </div>
          </div>
          {stageTimeline.length > 0 && (
            <div className="ref-stage-timeline">
              {stageTimeline.map((entry) => (
                <div key={`${entry.stage}-${entry.timestamp}`} className="ref-stage-timeline-item">
                  <div className="ref-stage-timeline-head">
                    <strong>{ANALYZE_STAGE_META[entry.stage].label}</strong>
                    <span>{(entry.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="ref-stage-timeline-meta">
                    平均 {(entry.aggregated.avgMs / 1000).toFixed(1)}s · {entry.aggregated.count} 次 · 最近 {(entry.aggregated.lastMs / 1000).toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        )}

        {step === 7 && analysisResult && (
          <SoulReportRef
            analysisResult={analysisResult}
            user={user}
            userScreenshotUrls={userScreenshotUrls}
            matchIntent={matchIntent}
            onSaveImage={() => void saveSoulPosterImage()}
          />
        )}
      </div>

      {tutorialPlatform && (
        <div className="ref-guide-modal" role="dialog" aria-modal="true">
          <div className="ref-guide-backdrop" onClick={() => setTutorialPlatform(null)} />
          <div className="ref-guide-panel">
            <div className="ref-guide-header">
              <div>
                <strong>{PLATFORM_NAMES[tutorialPlatform]} 绑定教程</strong>
                <p>按下面步骤操作，再把链接或 ID 粘贴回来即可。</p>
              </div>
              <button type="button" className="ref-guide-close" onClick={() => setTutorialPlatform(null)}>×</button>
            </div>
            <div className="ref-guide-steps">
              {PLATFORM_HINTS[tutorialPlatform].map((hint, index) => (
                <div key={index} className="ref-guide-step-block">
                  <div className="ref-guide-step-card">
                    <span>{index + 1}</span>
                    <div>
                      <p>{hint.text}</p>
                      {hint.link ? (
                        <a href={hint.link.href} target="_blank" rel="noopener noreferrer">
                          打开 {hint.link.label}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="ref-guide-shot-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/tutorials/${tutorialPlatform}-step${index + 1}.png`}
                      alt={`${PLATFORM_NAMES[tutorialPlatform]} 教程步骤 ${index + 1}`}
                      className="ref-guide-shot"
                      onError={(e) => {
                        e.currentTarget.closest('.ref-guide-shot-card')?.setAttribute('hidden', 'true');
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="ref-guide-example">
              <strong>示例格式</strong>
              <p>{PLATFORM_EXAMPLES[tutorialPlatform]}</p>
            </div>
            <div className="ref-guide-example">
              <strong>常见填错</strong>
              {PLATFORM_TUTORIAL_MEDIA[tutorialPlatform].pitfalls.map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void copyToClipboard(PLATFORM_EXAMPLES[tutorialPlatform], `已复制 ${PLATFORM_NAMES[tutorialPlatform]} 示例`)}
            >
              复制示例格式
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
