# Casebook Timeline（悬疑推理书架）

一个悬疑推理小说推荐站点，按时间线展示作品、支持按作者/系列筛选，并带收藏、评分、读后感等个人化功能。前身为纯静态页面（已归档至 `legacy/`），现已迁移为 **Next.js 16（App Router）+ Supabase** 全栈应用。

- 技术栈：Next.js 16.3（Turbopack）、React 19、TypeScript、Supabase（Postgres + Auth + RLS）

## 功能特色

- **时间线首页**：作品按出版时间排列，带雨幕/脚印动效
- **筛选浏览**：按作者、系列筛选，按年份分组
- **专题页**：每个作者/系列一个独立详情页
- **用户系统**：注册/登录（Supabase Auth，邮箱验证）、会话自动刷新
- **个人数据**：收藏、评分（1–5 星）、读后感，持久化到 Supabase，仅本人可见（RLS）

## 本地开发

### 1. 环境要求

- Node.js 20+
- 一个 [Supabase](https://supabase.com) 项目（免费档即可）

### 2. 初始化数据库

打开 Supabase 控制台 → SQL Editor，将 [`supabase/schema.sql`](supabase/schema.sql) 全部执行一次。它会创建：

- `books`、`authors`、`series`（公开可读）
- `favorites`、`ratings`、`notes`（RLS 保护，仅属主可读写）
- 种子数据：5 位作者、4 个系列、8 本推理小说

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`（本地无需提交）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> 项目 URL 不要带 `/rest/v1/` 后缀；ANON key 可在 Supabase 控制台 → Settings → API 找到。

### 4. 启动

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。

> 提示：本项目使用 Next.js 16，`middleware` 已更名为 `src/proxy.ts`。改动类型/页面后，建议先运行 `npx next typegen` 再 `npx tsc --noEmit`。

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页（时间线 + 筛选）
│   ├── topic/page.tsx        # 作者/系列专题页
│   ├── login|signup/page.tsx # 登录/注册
│   ├── auth/callback/route.ts# 邮箱验证回调
│   ├── actions/              # Server Actions（auth、user-data）
│   └── globals.css
├── components/               # 首页交互、表单、动效组件
├── lib/supabase/             # 服务端/浏览器客户端
├── lib/data.ts               # 数据读取封装
└── proxy.ts                  # 会话刷新代理（原 middleware）
supabase/schema.sql           # 建表 + RLS + 种子数据
legacy/                       # 迁移前的静态版备份
```
