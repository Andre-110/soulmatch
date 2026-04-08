# 模型分析的结构化结果

## 概览

LLM（OpenAI GPT-4o-mini）分析用户数据后，返回一个完整的 JSON 对象，包含以下核心结构：

## 1. 根对象结构 (`SoulReport`)

```typescript
{
  mbti: string;              // MBTI 人格类型
  title: string;             // 16字以内诗意称号
  avatarTags: string[];      // 3个标签
  blocks: Block[];           // 多个分析块（每个平台/数据源一个）
  overall: string;           // 200-450字浓缩总评
  article?: SoulReportArticle; // 长文档案（详细结构见下）
}
```

### 1.1 MBTI 类型 (`mbti`)

**格式**：
- 标准型：`"INFJ"`, `"ENFP"`, `"ISTJ"` 等
- 融合型：`"ISFJ×INFP"` （两种类型的混合）

**推断依据**：
- 平台公开数据（微博、小红书、抖音、网易云、豆瓣、知乎）
- 用户自述文字
- 上传的截图
- 行为模式分析

**用途**：
- 匹配专属形象图片（16个独立PNG）
- 匹配专属背景音乐（16首独立MP3）
- 展示人格维度百分比

### 1.2 标题和标签

```typescript
{
  title: "温柔的理想主义者",  // 诗意称号
  avatarTags: [
    "多源线索",
    "线上人格",
    "深度解读"
  ]
}
```

### 1.3 分析块 (`blocks`)

每个平台/数据源对应一个独立的 block：

```typescript
{
  source: "小红书·对外叙事与人设",  // 数据来源
  icon: "📕",                      // emoji 图标
  tags: ["公开信息", "视觉为主"],   // 标签
  title: "生活美学记录者",          // 14字以内核心结论
  description: "260-520字的详细分析..." // 平台角色定位、可核验细节
}
```

**blocks 数量规则**：
- 每个绑定的平台 = 1 个 block
- 用户上传的截图 = 1 个 block（如果有）
- 用户自述文字 = 1 个 block（如果有）

**示例**：用户绑定了 6 个平台 + 上传了截图 + 填写了自述 = 8 个 blocks

### 1.4 总评 (`overall`)

200-450 汉字的浓缩总评，供首屏展示，与长文互补。

## 2. 长文档案结构 (`article`)

### 2.1 开篇

```typescript
{
  headline: "你的全网人格100%实锤解码（基于6个平台）",
  guaranteeIntro: "2-4句承诺：每条结论可回查主页、无空泛套话..."
}
```

### 2.2 第一部分：全维度细节拆解

```typescript
section1: {
  sectionTitle: "一、全维度细节拆解：人格、爱好、表达与价值取向",
  
  // （一）核心人格
  corePersonality: {
    heading: "（一）核心人格：温柔的理想主义者 · INFJ",
    pillars: [
      {
        label: "I型人格底色（内向占比65%）",
        bullets: [
          "长句实锤1：从微博互动频率看...",
          "长句实锤2：小红书内容偏向..."
        ]
      },
      {
        label: "N型直觉感知（占比72%）",
        bullets: ["..."]
      }
    ]
  },
  
  // （二）兴趣爱好
  hobbies: {
    heading: "（二）兴趣爱好：基于可见主页线索",
    fixedGroups: [
      {
        groupTitle: "核心固定爱好",
        bullets: ["阅读文学作品...", "独立音乐鉴赏..."]
      },
      {
        groupTitle: "日常休闲爱好",
        bullets: ["咖啡馆探店...", "摄影记录..."]
      }
    ],
    casualBullets: ["补充说明..."]
  },
  
  // （三）说话风格
  speakingStyle: {
    heading: "（三）说话风格：温柔而有力量",
    evidenceNote: "以下基于小红书、微博公开文本",
    coreTone: "核心调性：温和、共情、有分寸感...",
    detailBullets: [
      "细节1：常用「可能」「或许」等柔化表达",
      "细节2：善用比喻和意象",
      "细节3：...",
      "细节4：..."
    ]
  },
  
  // （四）三观内核
  values: {
    heading: "（四）三观内核：理想与现实的平衡者",
    dimensions: [
      { label: "事业观", content: "追求意义大于追求成功..." },
      { label: "婚恋观", content: "重视精神契合..." },
      { label: "生活观", content: "慢生活倡导者..." },
      { label: "社交观", content: "质量优于数量..." }
    ]
  }
}
```

### 2.3 第二部分：名人参照

```typescript
section2: {
  sectionTitle: "二、和你灵魂高度契合的3位名人，以及最适配你的人生参考",
  
  celebrities: [
    {
      order: 1,
      name: "杨绛",
      angle: "内心丰盈·温柔有力量（匹配度92%）",
      evidence: "贴合实锤：你的小红书文字风格与杨绛散文有相似的..."
    },
    {
      order: 2,
      name: "李健",
      angle: "文艺浪漫·音乐同频（匹配度88%）",
      evidence: "贴合实锤：网易云听歌记录显示..."
    },
    {
      order: 3,
      name: "何炅",
      angle: "温暖治愈·高共情（匹配度85%）",
      evidence: "贴合实锤：从你的互动方式看..."
    }
  ],
  
  bestPick: {
    name: "杨绛",
    summary: "为何最适合做人生参考：2-6句详细说明..."
  }
}
```

### 2.4 第三部分：AI 分身的一天

```typescript
section3: {
  sectionTitle: "三、你的AI分身「小绛」的一天：温柔而坚定的生活节奏",
  personaName: "小绛",
  personaCore: "分身设定：内向型理想主义者，热爱阅读与思考...",
  
  timeline: [
    { clock: "07:30", paragraph: "自然醒，不设闹钟。窗外晨光..." },
    { clock: "09:00", paragraph: "泡一杯手冲咖啡，翻开昨晚..." },
    { clock: "12:00", paragraph: "简单午餐，一人食也要仪式感..." },
    { clock: "14:00", paragraph: "下午茶时间，在咖啡馆..." },
    { clock: "16:00", paragraph: "整理小红书素材..." },
    { clock: "18:00", paragraph: "晚餐时光..." },
    { clock: "21:00", paragraph: "夜读时间..." },
    { clock: "22:30", paragraph: "睡前冥想，回顾今日..." }
  ]
}
```

## 3. 数据持久化

所有结构化数据会被拆分存储到数据库：

### 3.1 Profile 表（主表）

```typescript
{
  // 输入元数据
  inputVersion: 1,
  inputReportSource: "openai" | "fallback",
  inputOpenaiModel: "gpt-4o-mini",
  inputContextCharLength: 15000,
  inputScreenshotCount: 5,
  inputVisionImageCount: 8,
  
  // 输出标量字段
  outputMbti: "INFJ",
  outputTitle: "温柔的理想主义者",
  outputOverall: "200-450字总评...",
  outputAvatarTag1: "多源线索",
  outputAvatarTag2: "线上人格",
  outputAvatarTag3: "深度解读"
}
```

### 3.2 关联子表

- **ProfileInputScrape**: 每个平台的抓取结果
- **ProfileInputUserText**: 用户自述文字
- **ProfileInputScreenshotUrl**: 用户上传的截图URL
- **ProfileOutputBlock**: 每个分析块的详细内容

## 4. 前端展示映射

### 4.1 首屏

- MBTI 类型 → 专属形象图 + 专属音乐
- `title` → 主标题
- `avatarTags` → 3个标签
- MBTI 维度百分比（从 `mbti` 计算）

### 4.2 场景卡片（4个）

从 `blocks` 数组的前 4 个元素提取：
- `source` → 场景标题
- `icon` → 图标
- `description` → 场景描述

### 4.3 更多线索解读

`blocks` 数组的第 5-8 个元素（如果有）

### 4.4 长文档案

完整渲染 `article` 对象的所有内容

## 5. 模型输入

### 5.1 System Prompt

位置：`lib/prompts/soul-report/system-instructions.md`

包含：
- 写作风格指令
- 实锤优先原则
- MBTI 推断规则
- blocks 规则
- article 长文规则

### 5.2 User Message

```typescript
{
  type: "text",
  text: "【多模态图片顺序说明】+ 各平台抓取摘录 + 用户自述 + 截图说明"
}
```

加上：

```typescript
[
  { type: "image_url", image_url: { url: "data:image/png;base64,...", detail: "low" } },
  // ... 最多 8 张截图（平台截图 + 用户上传）
]
```

### 5.3 模型配置

```typescript
{
  model: "gpt-4o-mini",
  temperature: 0.58,
  max_tokens: 16384,
  response_format: { type: "json_object" }
}
```

## 6. 兜底机制

如果 OpenAI API 失败或未配置 `OPENAI_API_KEY`：

```typescript
buildFallbackSoulReport({
  scrapes,      // 平台抓取结果
  userTexts,    // 用户自述
  screenshotCount // 截图数量
})
```

返回基础版本：
- `mbti: "待模型"`
- 简单的 blocks（直接展示抓取摘录）
- 占位的 article（提示需要配置 API Key）

## 总结

模型分析的结构化结果包含：

1. **MBTI 类型** - 驱动形象和音乐匹配
2. **标题和标签** - 首屏展示
3. **分析块数组** - 每个数据源的独立分析
4. **浓缩总评** - 快速了解
5. **长文档案** - 三大部分详细解读
   - 全维度细节拆解（人格、爱好、表达、价值观）
   - 3位名人参照
   - AI 分身的一天（8个时段）

所有内容都基于用户提供的真实数据，遵循"实锤优先、可核验"的原则。
