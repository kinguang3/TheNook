<div align="center">

# TheNook · Casebook Timeline

**一个专注于推理小说的发现与收藏平台**

以纵向时间线呈现的推理小说推荐站点 —— 浏览、收藏、评分、追踪阅读进度，并为每一本书写下公开书评。

Next.js 16 · React 19 · TypeScript · Supabase

</div>

---

## 功能特色

- **时间线首页**：作品按出版年份纵向展开，配雨幕与脚印动效；核心 slogan 以打字机效果多句循环播放
- **全局搜索**：单一输入框同时检索作者（名/摘要/相关书）、书籍（标题/摘要/标签/作者/系列）、时间线节点（标题/年份/标签），URL 同步（`/search?q=`）可分享；跳转时间线时自动定位节点并短暂高亮
- **筛选浏览**：按标签筛选书目，按作者、系列进入专题页
- **公开书评**：每本书拥有独立书评页（`/books/<bookId>/reviews`），登录后可发表、编辑、删除自己的评论；时间线卡片直接展示最新书评，点击直达对应书籍并锚点定位高亮
- **书架**：收藏即上架，带真实封面（Supabase Storage）；阅读进度条自动推导未开始 / 阅读中 / 已读完，支持状态切换、搜索筛选、移出书架
- **个人数据**：收藏、评分（1–5 星）持久化到 Supabase，仅本人可见（RLS）
- **读者综合评分**：聚合所有用户评分的平均分（`rating_stats` 视图），全站统一展示；书评页同时显示个人评分交互
- **用户系统**：注册 / 登录（Supabase Auth，邮箱验证），会话自动刷新

## 快速开始

### 1. 环境要求

- Node.js 20+
- 一个 [Supabase](https://supabase.com) 项目（免费档即可）

### 2. 初始化数据库

在 Supabase 控制台 → SQL Editor 中执行 SQL：

- **全新项目**：执行 [`supabase/schema.sql`](supabase/schema.sql)，一次建全所有表、RLS 与种子数据
- **已有数据库**：只执行增量迁移脚本（如 `migration-reviews.sql`），不要重跑全量文件

包含的数据表：

| 表/视图 | 用途 | 可见性 |
| --- | --- | --- |
| `authors` / `series` / `books` | 目录数据（含 5 位作者、4 个系列、8 本书的种子数据） | 公开可读 |
| `favorites` / `ratings` / `notes` / `shelf` | 用户个人数据 | 仅属主（RLS） |
| `profiles` | 评论者昵称，注册时由触发器自动建档 | 公开可读 |
| `reviews` | 公开书评，绑定 book_id + user_id | 公开可读，仅本人可写 |
| `rating_stats`（视图） | 聚合所有用户评分的平均分与人数，支撑首页/搜索页综合评分展示 | 公开可读（GRANT），不含 user_id 等可识别列 |

> 请勿删表重建，否则会丢失用户数据。

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`（本地无需提交）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> 项目 URL 不要带 `/rest/v1/` 后缀；ANON key 在 Supabase 控制台 → Settings → API。

### 4. 配置封面存储（可选）

1. Supabase 控制台 → Storage → New bucket，名称 `covers`，勾选 **Public bucket**
2. 将封面 URL 写入 `books.cover_url`，格式：
   `https://<project-ref>.supabase.co/storage/v1/object/public/covers/<文件名>`
3. 无封面时页面自动回退为色块 + 编号样式

### 5. 启动

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。

## 项目结构

```
src/
├── app/
│   ├── page.tsx                        # 首页（时间线 + 筛选 + 书评预览）
│   ├── search/page.tsx                 # 全局搜索页（需登录）
│   ├── books/[bookId]/reviews/page.tsx # 每本书的独立书评页
│   ├── shelf/page.tsx                  # 用户书架（收藏 + 阅读进度）
│   ├── topic/page.tsx                  # 作者/系列专题页
│   ├── login|signup/page.tsx           # 登录/注册
│   ├── auth/callback/route.ts          # 邮箱验证回调
│   ├── actions/                        # Server Actions（auth / user-data / shelf / reviews）
│   └── globals.css
├── components/                         # 侧边栏、书架、书评、搜索、打字机、动效组件
├── lib/
│   ├── supabase/                       # 服务端/浏览器客户端
│   ├── data.ts                         # 数据读取封装
│   └── types.ts                        # 领域类型
└── proxy.ts                            # 会话刷新代理（Next.js 16 替代 middleware）
supabase/schema.sql                     # 全量建表 + RLS + 种子数据 + 聚合视图
```

## 开发提示

- 本项目使用 Next.js 16，`middleware` 已更名为 `src/proxy.ts`
- 改动类型或页面后，先运行 `npx next typegen` 再 `npx tsc --noEmit` 做类型检查
- 书评权限模型：所有人可读，登录用户可发表（身份由 RLS `auth.uid()` 保证），仅作者本人可修改/删除
- `rating_stats` 是 security definer 视图，不支持 RLS；公开读取通过 `grant select to anon, authenticated` 授权
- 搜索页面需要登录，未登录访问会自动重定向到 `/login`
