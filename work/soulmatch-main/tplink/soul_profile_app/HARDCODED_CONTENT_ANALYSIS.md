# 硬编码内容分析报告

## 问题：模型生成的回复是否有硬编码？

### ✅ 结论：模型生成的核心内容**没有硬编码**

## 详细分析

### 1. 模型生成的内容（完全动态）

以下内容**100% 由 LLM 生成**，没有任何硬编码：

#### ✅ 核心字段
```typescript
{
  mbti: "INFJ",                    // ✅ LLM 分析生成
  title: "温柔的理想主义者",         // ✅ LLM 生成
  avatarTags: ["标签1", "标签2"],   // ✅ LLM 生成
  overall: "200-450字总评...",      // ✅ LLM 生成
  blocks: [...]                     // ✅ LLM 生成（每个平台的分析）
}
```

#### ✅ 长文档案 (article)
```typescript
{
  headline: "...",                  // ✅ LLM 生成
  guaranteeIntro: "...",            // ✅ LLM 生成
  section1: {
    corePersonality: {...},         // ✅ LLM 生成
    hobbies: {...},                 // ✅ LLM 生成
    speakingStyle: {...},           // ✅ LLM 生成
    values: {...}                   // ✅ LLM 生成
  },
  section2: {
    celebrities: [                  // ✅ LLM 生成（3位名人）
      { name: "...", angle: "...", evidence: "..." }
    ],
    bestPick: {...}                 // ✅ LLM 生成
  },
  section3: {
    personaName: "...",             // ✅ LLM 生成
    personaCore: "...",             // ✅ LLM 生成
    timeline: [...]                 // ✅ LLM 生成（8个时段）
  }
}
```

### 2. 前端展示层的硬编码（仅 UI 装饰）

以下是**前端组件中的硬编码**，但**不影响模型生成的内容**：

#### ⚠️ 场景预设（UI 装饰）
```typescript
// components/SoulReportRef.tsx:15-48
const REF_SCENE_PRESETS = [
  {
    tagline: '生活的美好，藏在每一个重复的小习惯里',  // 硬编码标语
    time: '🌤️ 08:00 · 晨起时刻',                    // 硬编码时间
    gradient: '...',                                 // 硬编码渐变色
    // ...
  },
  // ... 共 4 个场景
];
```

**用途**：仅用于 4 个场景卡片的**背景装饰**（标语、时间、渐变色）  
**内容来源**：场景卡片的**实际内容**（标题、描述）来自 `blocks` 数组（LLM 生成）

```typescript
// 第 229-263 行
REF_SCENE_PRESETS.map((scene, idx) => {
  const b = blocks[idx] || { /* 默认占位 */ };  // ✅ 使用 LLM 生成的 blocks
  return (
    <section style={{ background: scene.gradient }}>  {/* ⚠️ 硬编码背景 */}
      <p>{scene.tagline}</p>                          {/* ⚠️ 硬编码标语 */}
      <p>{scene.time}</p>                             {/* ⚠️ 硬编码时间 */}
      <p>{b.title}</p>                                {/* ✅ LLM 生成的标题 */}
      <p>{b.description}</p>                          {/* ✅ LLM 生成的描述 */}
      <p>来源：{b.source}</p>                         {/* ✅ LLM 生成的来源 */}
    </section>
  );
});
```

#### ⚠️ 名人占位（UI 装饰，未使用）
```typescript
// components/SoulReportRef.tsx:50-61
const REF_CELEBRITY = {
  like: [
    { name: '何炅', desc: '温暖治愈·高共情' },
    { name: '苏东坡', desc: '一半烟火·一半诗意' },
    { name: '杨绛', desc: '内心丰盈·温柔有力量' },
  ],
  match: [
    { name: '李健', desc: '文艺浪漫·音乐同频' },
    { name: '李清照', desc: '细腻敏感·懂你的诗' },
    { name: '王阳明', desc: '内心坚定·懂你的温柔' },
  ],
};
```

**用途**：在第一屏展示 6 个名人卡片（UI 装饰）  
**问题**：这些是**硬编码的占位名人**，与 LLM 生成的 `article.section2.celebrities` **无关**

**当前状态**：
- ❌ 前端展示的名人是硬编码的 6 个固定名人
- ✅ LLM 生成的 3 位真实匹配名人存储在 `article.section2.celebrities`
- ⚠️ **前端没有使用 LLM 生成的名人数据**

### 3. 数据流对比

#### 当前实现
```
LLM 生成 → article.section2.celebrities (3位真实名人)
                    ↓
              存储到数据库
                    ↓
              ❌ 前端未使用
                    
前端展示 ← REF_CELEBRITY (6个硬编码名人) ← 硬编码常量
```

#### 应该的实现
```
LLM 生成 → article.section2.celebrities (3位真实名人)
                    ↓
              存储到数据库
                    ↓
              ✅ 前端读取并展示
```

## 总结

### ✅ 没有硬编码的内容（核心数据）
1. **MBTI 类型** - 完全由 LLM 分析生成
2. **标题和标签** - 完全由 LLM 生成
3. **分析块 (blocks)** - 每个平台的分析都是 LLM 生成
4. **总评 (overall)** - LLM 生成
5. **长文档案 (article)** - 所有内容都是 LLM 生成
   - 核心人格、兴趣爱好、说话风格、三观内核
   - 3位名人参照（存储在数据库，但前端未使用）
   - AI 分身的一天（8个时段）

### ⚠️ 有硬编码的内容（UI 装饰）
1. **场景预设** - 4个场景的标语、时间、渐变色（仅装饰）
2. **名人卡片** - 6个固定名人（占位，应该替换为 LLM 生成的数据）

### 🔧 需要修复的问题

**问题**：前端展示的名人是硬编码的，没有使用 LLM 生成的真实匹配名人。

**解决方案**：修改 `SoulReportRef.tsx`，从 `analysisResult.article.section2.celebrities` 读取 LLM 生成的名人数据。

## 验证方法

### 查看 LLM 生成的名人数据
```bash
# 查看数据库中最新的 profile
npm run db:recent

# 或者查看 API 返回的完整 JSON
# 在浏览器 DevTools → Network → analyze → Response
```

### 确认前端是否使用了 LLM 数据
```typescript
// 检查 Props 类型定义
type Props = {
  analysisResult: {
    mbti?: string;
    title?: string;
    overall?: string;
    avatarTags?: string[];
    blocks?: [...];
    article?: SoulReportArticle;  // ❓ 是否包含 article？
  };
};
```

**当前状态**：`Props.analysisResult` **不包含** `article` 字段，所以前端无法访问 LLM 生成的名人数据。
