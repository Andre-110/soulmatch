---
name: idea-mvp
description: 为筛选过的产品 idea 制作 MVP 原型：PRD 文档 + 核心页面高保真 Demo 截图，用于目标用户验证付费意愿
user_invocable: true
---

# Idea MVP — 产品 MVP 原型设计

为产品 idea 快速生成 MVP 原型：精简 PRD + 核心页面高保真 Demo 图片。
**核心目的**：让目标用户通过查看 Demo 图片，判断产品是否解决痛点、是否愿意付费。

## Invocation

Trigger: `/idea-mvp`
Description: 产品 MVP 原型设计。输入 IDEA 文件路径/编号或自由描述，输出 PRD + 核心页面 Demo 截图。

## Arguments

- `<IDEA 文件路径>`: 产品创意与调研及评审目录下的 IDEA 文件路径（支持以下格式）：
  - 完整路径：`/Users/di/.../产品创意与调研及评审/IDEA-0009.md`
  - 文件名：`IDEA-0009.md`（自动在 `IDEA_DIR` 下查找）
  - 编号：`9` 或 `0009`（自动匹配 `IDEA-0009.md`）
- `<Obsidian 文档链接>`: Obsidian wikilink 或文件路径，指向包含详细需求描述的文档（如 `[[20260320_某产品需求]]`、`[[产品需求文档.md]]`、或完整路径）
- `<文本描述>`: 自由文本描述一个产品 idea
- 无参数: 提示用户选择输入方式

## Constants

```yaml
OBSIDIAN_OUTPUT_DIR: "/Users/di/Dropbox/Learning/Obsidian/Di's Dropbox Vault/7. 项目/20260317_产品 MVP 设计"
ASSETS_DIR: "${OBSIDIAN_OUTPUT_DIR}/assets"
IDEA_DIR: "/Users/di/Dropbox/Learning/Obsidian/Di's Dropbox Vault/7. 项目/20260203_产品 ideas 发掘/产品创意与调研及评审"
HTML_WORK_DIR: "/Users/di/Dropbox/Learning/_CodingProjects/2026-03-17_Idea_MVP/html"
SCREENSHOT_SCRIPT: "/Users/di/.claude/skills/idea-mvp/scripts/screenshot.py"
```

## ⚠️ 核心原则（贯穿全流程）

1. **只做 MVP**：1-2 个核心功能，砍掉一切非核心（登录/注册/支付/设置/通知/个人中心等）
2. **以验证为目的**：Demo 给目标用户看——让外行一眼看懂产品做什么、怎么用
3. **真实感 > 完美**：用真实文案和数据，不用 Lorem ipsum；配色排版要专业但不需像素级精确
4. **快速迭代**：第一版不求完美，靠用户反馈快速修正
5. **极简**：3-5 个核心页面，PRD 不超过 500 字正文

---

## Workflow

### Phase 0: 输入解析

**如果输入是 IDEA 文件路径或编号：**

支持以下输入格式：
- 完整路径：直接读取该文件
- 文件名（如 `IDEA-0009.md`）：在 `IDEA_DIR` 下查找
- 编号（如 `9` 或 `0009`）：自动拼接为 `IDEA_DIR/IDEA-{编号补零到4位}.md`

处理流程：
1. 解析输入，定位到具体的 IDEA-XXXX.md 文件
2. 读取文件全文，提取：名称（标题行）、整体综合评价、用户痛点、解决方案、目标用户画像、竞品分析、市场规模、主要风险等
3. 将这些信息作为 Phase 1 的上下文
4. 来源标注为 "IDEA 文件：IDEA-XXXX"

**如果输入是 Obsidian 文档链接：**

支持以下格式：
- Wikilink：`[[文档名称]]` 或 `[[文档名称|显示名]]`
- 文件路径：`/path/to/文档.md` 或相对路径 `文档.md`
- Obsidian URI：`obsidian://open?vault=...&file=...`

处理流程：
1. 解析链接，提取文档名称或路径
2. 在 Obsidian vault 目录（`/Users/di/Dropbox/Learning/Obsidian/Di's Dropbox Vault/`）下搜索该文档：
   - 先用 Glob 按文件名精确匹配：`**/<文档名称>.md`
   - 若未找到，用 Grep 搜索 `aliases` frontmatter 中包含该名称的文件
3. 读取文档全文，提取以下信息作为 Phase 1 上下文：
   - frontmatter 中的元数据（tags、status、相关链接等）
   - 正文中的需求描述、用户画像、痛点分析、功能列表等
   - 文档中嵌入的图片/截图路径（如有）
4. 来源标注为 "Obsidian 文档：[[文档名称]]"

> **提示**：Obsidian 文档可以是任意格式——需求文档、会议纪要、brainstorm 笔记、竞品分析等。Phase 0 会自动从中提取与 MVP 设计相关的信息。

**如果输入是文本描述：**
1. 直接将描述作为 Phase 1 的上下文
2. 来源标注为 "用户直接输入"

**如果无参数：**
1. 问用户："请提供 IDEA 文件路径/编号（如 `IDEA-0009.md` 或 `9`）、Obsidian 文档链接，或直接描述你的产品 idea"

---

### Phase 1: Plan Mode — 需求澄清

⚠️ **立即进入 Plan Mode**

基于输入信息，向用户确认以下关键问题（已有信息的不重复问）：

1. **目标用户**：具体画像（不是泛泛的 "年轻人"）
2. **核心痛点**：一句话
3. **MVP 核心功能**：只做哪 1-2 个？（提出你的建议，让用户确认/修改）
4. **平台**：iOS / Web / 两者？
5. **语言**：中文 / 英文 / 双语？

**规则**：
- 2-3 轮对话内完成，不要问超出 MVP 范围的问题
- 如果从产品创意库获取了充分信息，可以直接给出建议让用户确认，减少问答轮次
- 不要问 "你有什么偏好的配色方案吗" 之类的设计细节——自己决定

---

### Phase 2: 产品定义确认

在 Plan Mode 内，输出以下格式供用户确认：

```
📋 产品定义
━━━━━━━━━━━━━━━━━━━━
产品名称：[名称]
一句话描述：[用户视角的价值主张]
目标用户：[具体画像]
核心痛点：[一句话]
━━━━━━━━━━━━━━━━━━━━
🎯 MVP 核心功能（仅以下，不多做）
1. [功能1]：[简述]
2. [功能2]：[简述]（如有）
━━━━━━━━━━━━━━━━━━━━
📱 平台：[iOS / Web / Both]
🌐 语言：[中文 / English]
━━━━━━━━━━━━━━━━━━━━
📐 核心页面清单（将生成 Demo 截图）
1. [页面1]：[这个页面展示什么]
2. [页面2]：[这个页面展示什么]
3. [页面3]：[这个页面展示什么]
（3-5 个页面）
```

用户确认后 → **退出 Plan Mode，进入执行阶段**

---

### Phase 3: PRD 撰写

⚠️ **退出 Plan Mode 后执行**

#### 3a. 创建输出文件

1. 确保 `OBSIDIAN_OUTPUT_DIR` 和 `ASSETS_DIR` 目录存在（`mkdir -p`）
2. 文件名：`YYYYMMDD_产品名称.md`（如 `20260317_租房防坑工具箱.md`）
3. 写入 frontmatter + v1.0 初始版本

#### 3b. PRD 内容（精简，≤500 字正文）

```markdown
### PRD

#### 问题陈述
[2-3 句描述痛点和现状]

#### 目标用户
[画像 + 使用场景，2-3 句]

#### 核心功能

**功能 1：[名称]**
- 用户故事：作为 [角色]，我想要 [行为]，以便 [价值]
- 关键交互：[核心操作流程]

**功能 2：[名称]**（如有）
- 用户故事：...
- 关键交互：...

#### 核心用户流程
[主操作路径：打开 → 看到 X → 操作 Y → 得到 Z]

#### 成功指标
- [指标1]
- [指标2]
```

---

### Phase 4: 生成 Demo UI — 双版本设计

⚠️ **MANDATORY — DO NOT SKIP。HTML 预览 + 截图是核心交付物。**

**每个产品必须生成两个设计版本**，使用两个不同的设计 skill：

| 版本后缀 | 设计 Skill | 风格定位 |
|----------|-----------|----------|
| `_fdpro` | `frontend-design-pro` (`/Users/di/skills/frontend-design-pro/SKILL.md`) | 专业克制，Linear/Stripe 质感 |
| `_uiux` | `ui-ux-design` (`/Users/di/skills/ui-ux-design/SKILL.md`) | 深色 Hero + 极简内容，Vercel 风格 |

**对每个核心页面，分别用两个 skill 的设计规范各生成一版。**

#### Step 1: 生成 HTML 文件（可交互预览版）

在 `HTML_WORK_DIR` 下为每个页面创建两版 HTML 文件：
- `home_fdpro.html` / `home_uiux.html`
- `detail_fdpro.html` / `detail_uiux.html`
- ...

⚠️ **用 Agent 并行生成两版以提高效率。**

**HTML 要求：**
- 完整的 `<!DOCTYPE html>` 结构
- 所有 CSS 内联在 `<style>` 标签中
- 使用真实、合理的示例文案（不用占位符）
- **图标：Lucide Icons**（CDN: `unpkg.com/lucide@latest/dist/umd/lucide.min.js`），`<i data-lucide="icon-name"></i>` + `lucide.createIcons()`
- **❌ 禁止使用 emoji 做 UI 图标**（功能图标、Tab 栏、按钮图标等全部用 Lucide SVG）
- Google Fonts CDN 引入专业字体（DM Sans、Instrument Serif、Inter 等）
- 设计规范参考对应 skill 的 SKILL.md
- CSS 变量管理配色、间距、圆角
- 包含微交互动效（hover/active/focus states）

#### Step 2: 截图（全页面截图）

使用 Playwright 截图脚本（默认生成全页面截图，不限于首屏）：
```bash
python3 /Users/di/.claude/skills/idea-mvp/scripts/screenshot.py \
  <html文件路径> \
  <输出png路径> \
  [宽度] [高度]
```

- iOS 平台：`390 844`（宽度390，高度参数仅影响 viewport，截图会包含完整页面）
- Web 平台：`1440 900`

截图保存到 `ASSETS_DIR`，两版分别命名：
- `YYYYMMDD_产品名称_v版本_页面名_fdpro.png`
- `YYYYMMDD_产品名称_v版本_页面名_uiux.png`

#### Step 3: 嵌入 MD 文件

在 Obsidian MD 文件中，两版并排展示（方便对比），并附 HTML 预览链接：

```markdown
#### 首页

| frontend-design-pro | ui-ux-design |
|:---:|:---:|
| ![[assets/YYYYMMDD_产品名称_v1_首页_fdpro.png\|180]] | ![[assets/YYYYMMDD_产品名称_v1_首页_uiux.png\|180]] |

> [!tip] HTML 预览（可交互）
> - fdpro 版：`file:///Users/di/.../html/home_fdpro.html`
> - uiux 版：`file:///Users/di/.../html/home_uiux.html`
```

---

### Phase 5: 输出 & 评审

1. 告知用户 Obsidian MD 文件的完整路径
2. 提示用户在 Obsidian 中查看效果
3. 等待用户反馈后：
   - 收集 **评分**（1-10 分）
   - 收集 **具体反馈**（哪些页面/元素需要改）

---

### Phase 6: 迭代

**如果评分 < 8：**
1. 分析用户反馈，明确需要修改什么
2. 在同一 MD 文件 **顶部**（frontmatter 之后）新增版本 section（v1.1, v1.2...）
3. 重新生成需要修改的 HTML 和截图（未改的页面可复用）
4. 更新 frontmatter：`version`、`updated`、`latest_score`
5. 回到 Phase 5

**如果评分 ≥ 8：**
1. 更新 frontmatter：`status: "已完成"`
2. 输出最终总结：产品名称 + 核心功能 + 最终评分 + 文件路径

---

## UI 设计规范

### iOS 平台

```css
/* 基础参数 */
viewport: 390×844 (iPhone 14)
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
```

**必须包含的元素：**
- 顶部状态栏（时间居中、左侧信号、右侧电池）— 高度 54px
- 导航栏（大标题 34px bold 或标准标题 17px semibold）
- 底部安全区（高度 34px）
- 如有多页面：底部 Tab Bar（高度 83px 含安全区）

**视觉风格：**
- 圆角卡片：12-16px border-radius
- 标准边距：16px
- 分隔线：0.5px `rgba(0,0,0,0.1)`
- iOS 系统蓝：`#007AFF`
- 背景灰：`#F2F2F7`
- 卡片白：`#FFFFFF`

**参考 `/mobile-ios-design` skill 中的 HIG 原则。**

### Web 平台

```css
/* 基础参数 */
viewport: 1440×900 (桌面)
font-family: Inter, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
max-width: 1200px; margin: 0 auto;
```

**必须包含的元素：**
- 顶部导航栏（logo + 核心导航项 + CTA 按钮）
- 页脚（简化版即可）

**视觉风格：**
- 大留白，清晰视觉层级
- 卡片阴影：`0 2px 8px rgba(0,0,0,0.08)`
- 主色根据产品调性选择（科技蓝、健康绿、金融深蓝等）
- 圆角：8-12px
- 按钮高度：40-48px

### 通用规则

1. **真实文案**：用合理的示例数据，符合目标市场语言（如中国市场用中文人名地名）
2. **图标**：**全部使用 Lucide Icons**（CDN 引入），`<i data-lucide="icon-name"></i>` + `lucide.createIcons()`。**❌ 禁止使用 emoji 做 UI 图标**（Tab 栏、功能图标、按钮图标等），emoji 只允许作为内容标识（如宠物头像）
3. **字体**：通过 Google Fonts CDN 引入专业字体，禁止使用 Arial、Inter、system-ui 等通用字体
4. **配色一致**：主色 + 辅色 + 中性色，全页面统一，使用 CSS 变量管理
5. **文字层级**：标题 > 副标题 > 正文 > 辅助文字，大小和颜色有明确区分
6. **CTA 突出**：核心操作按钮用主色 + 大尺寸 + 充足留白
7. **微交互**：hover/active/focus 状态，使用 `cubic-bezier(0.16, 1, 0.3, 1)` easing，禁止 bounce/elastic
8. **不要**：渐变背景墙纸、装饰性插画、emoji 图标、bounce 动画——简洁专业即可

---

## Obsidian 文档模板

```markdown
---
idea_source: "[IDEA 文件：IDEA-XXXX / Obsidian 文档：[[文档名]] / 用户直接输入]"
idea_name: "[产品名称]"
platform: "[iOS / Web / Both]"
market: "[中国 / 全球 / 双市场]"
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: v1.0
latest_score: 0
status: "设计中"
tags:
  - mvp-design
  - product
aliases:
  - [产品名称] MVP
---

# [产品名称] MVP 设计

> [!info] 最新版本：v1.0 | 评分：— | 状态：设计中

---

## v1.0 (YYYY-MM-DD) — 初始版本

### 变更说明
初始版本

### PRD
[PRD 内容]

### Demo 截图

#### [页面1名称]
![[assets/YYYYMMDD_产品名称_v1_页面1.png]]

#### [页面2名称]
![[assets/YYYYMMDD_产品名称_v1_页面2.png]]

### 评审
- **评分**：—/10
- **反馈**：待用户评审
```

---

## 反模式清单

| ❌ 不要 | ✅ 应该 |
|---------|---------|
| 设计 >2 个功能 | 只做 1-2 个核心功能 |
| 超过 5 个页面 | 3-5 个核心页面 |
| 占位符文案 (Lorem ipsum) | 真实合理的示例文案 |
| Plan Mode 问 >3 轮 | 2-3 轮快速确认 |
| PRD 超过 500 字 | 精简聚焦 |
| 跳过截图步骤 | 截图是核心交付物，必须完成 |
| 迭代时创建新文件 | 在同一文件顶部新增版本 |
| 添加登录/注册/支付页面 | 只展示核心功能页面 |
| 问用户配色偏好 | 自己基于产品调性决定 |
| 用 emoji 做 UI 图标 | 全部用 Lucide Icons（CDN 引入） |
| 只生成一个设计版本 | 用 fdpro + uiux 两个 skill 各生成一版 |
| 只有截图没有 HTML | 同时提供可交互 HTML 预览 + 截图 |
