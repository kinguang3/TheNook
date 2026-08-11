# OpenCode 用户书架（Book Collection）React 组件提示词

> 严格遵循 OpenCode 设计系统，按阅读进度排序，书籍序号保持原始准确值。

---

## 可直接复制使用的完整提示词

```markdown
你是一位顶级前端工程师，精通 React + 严格设计系统落地。请根据以下 OpenCode 设计系统，实现一个「用户书架（Book Collection）」React 组件。

### 设计系统硬性约束（必须100%遵守）

- 字体：全部使用 Berkeley Mono（或 fallback: JetBrains Mono / IBM Plex Mono），禁止任何 sans-serif。
- 背景：仅允许 `#fdfcfc`（canvas）。
- 文字主色：`#201d1d`（ink）。
- 次要文字：`#424245`（body）、`#646262`（mute）、`#9a9898`（ash）。
- 圆角：交互元素仅允许 `4px`，容器一律 `0px`。
- 无阴影、无渐变、无装饰图片、无彩色图标。
- 列表使用 ASCII 括号作为视觉标记：`[+]`、`[-]`、`[x]`、`[ ]`。
- 分割线仅使用 1px `rgba(15,0,0,0.12)` hairline。
- 间距遵循 OpenCode spacing 体系（尤其是 section 96px 节奏）。
- 整体视觉必须像一份终端 manpage / README，而不是现代卡片式 UI。

### 功能要求

1. **排序规则（核心）**
   - 严格按「阅读进度」降序排列（progress 高的排在前面）。
   - **不要**按书籍数字序号、添加时间或字母顺序排列。
   - 进度相同则按书名稳定排序。

2. **书籍展示信息**
   - 序号（准确显示原始 book_id 或用户自定义编号，不要重新编造连续序号）
   - 书名
   - 作者
   - 阅读进度（百分比 + 进度条，进度条用纯 CSS 实现，颜色用 ink `#201d1d`）
   - 状态标记：`[x]` 已读完 / `[+]` 阅读中 / `[ ]` 未开始
   - 可选：上次阅读时间（用 mute 色）

3. **交互**
   - 每行可点击进入详情（或触发 onBookClick 回调）
   - 支持简单搜索（按书名/作者过滤）
   - 支持按状态筛选（全部 / 阅读中 / 已读完 / 未开始）
   - 空状态使用 ASCII 风格提示

4. **组件接口**
```tsx
interface Book {
  id: string | number;          // 原始准确序号，禁止重新编号
  title: string;
  author: string;
  progress: number;             // 0-100
  status: 'reading' | 'finished' | 'unread';
  lastReadAt?: string;          // ISO 或相对时间
}

interface BookshelfProps {
  books: Book[];
  onBookClick?: (book: Book) => void;
  className?: string;
}
```

### 视觉结构建议（必须保持 OpenCode 风格）

- 顶部：标题「USER BOOKSHELF」+ 书籍总数（用 heading-md 16px/700）
- 搜索框 + 状态筛选 tabs（使用 button-tab / button-tab-active 风格）
- 列表每行：
  ```
  [+]  003  《书名》  — 作者名          68%  ████████░░
  ```
  或更紧凑的 monospaced 对齐布局
- 使用 hairline 分割行
- 整体最大宽度控制在 960px 左右，左对齐

### 输出要求

1. 输出完整可运行的 React 函数组件（TypeScript）
2. 使用纯 CSS 或 Tailwind（如果用 Tailwind，必须映射到 OpenCode 颜色与圆角）
3. 不要引入任何额外图标库
4. 代码干净、注释清晰，标明哪些地方严格遵循了设计 token
5. 在组件顶部用注释列出使用的主要设计 token

请直接输出完整代码，不要额外解释。
```

---

## 设计思路说明

1. **角色设定**：明确「顶级前端工程师 + 严格设计系统落地」，强制模型遵守约束。
2. **硬性约束前置**：把 OpenCode 的核心视觉规则（100% 等宽、奶油底、近黑墨、4px 圆角、ASCII 括号、无阴影）全部写成不可违反的规则。
3. **排序规则强化**：明确「按阅读进度降序，序号保持原始准确值」，解决「书籍序号要准确」和「不要按表数字顺序」的需求。
4. **组件接口清晰**：方便直接接入真实数据。
5. **视觉结构**：故意做成终端列表感，完全贴合 DESIGN-opencode.ai.md 的 manpage / README 风格。

---

## 使用建议

- 直接把「可直接复制使用的完整提示词」部分复制给 Claude 3.5/4、GPT-4o 或 Cursor。
- 如果模型输出不够严格，可追加：「请再次检查是否 100% 使用了 Berkeley Mono，是否出现了任何阴影或圆角 > 4px」。
- 需要我再生成「已写好的完整组件代码版本」或「带 mock 数据的可预览版本」，随时告诉我。
```

文件已写入：`/home/workdir/artifacts/OpenCode-用户书架-React组件提示词.md`