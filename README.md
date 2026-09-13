<div align="center">

# TheNook · Casebook Timeline

**一个专注于推理小说的发现与收藏平台**

以纵向时间线呈现的推理小说推荐站点 —— 浏览、收藏、评分、追踪阅读进度，并为每一本书写下公开书评。

Next.js 16 · React 19 · TypeScript · Supabase

</div>

---

## 功能特色

- **案件档案时间线**：作品按出版年份纵向展开，每本书分配 CASE 001-010 编号；打字机效果循环播放"每一本都是一场未完成的对话，等待被重新打开。"与"沿着时间线，重走那些让人失眠的推理小说。"
- **三维筛选系统**：按地区（欧美/日系）、年代（1980s-2020s）、类型（本格推理/孤岛/连环杀手等）筛选书目
- **全局搜索**：单一输入框同时检索作者、书籍、时间线节点，URL 同步（`/search?q=`）可分享
- **公开书评**：每本书拥有独立书评页（`/books/<bookId>/reviews`），登录后可发表、编辑、删除自己的评论
- **书架**：收藏即上架，带真实封面（Supabase Storage）；阅读进度条自动推导未开始 / 阅读中 / 已读完
- **个人数据**：收藏、评分（1–5 星）持久化到 Supabase，仅本人可见（RLS）
- **读者综合评分**：聚合所有用户评分的平均分（`rating_stats` 视图），全站统一展示
- **推荐算法（离线）**：Python 实现的 Item-Based 协同过滤，基于全体用户评分计算书籍相似度并生成 Top-N 推荐
- **用户系统**：注册 / 登录 / 忘记密码（Supabase Auth，邮箱验证），会话自动刷新

## 快速开始

### 1. 环境要求

- Node.js 20+
- 一个 [Supabase](https://supabase.com) 项目（免费档即可）

### 2. 初始化数据库

在 Supabase 控制台 → SQL Editor 中执行 SQL：

- **全新项目**：执行 [`supabase/schema.sql`](supabase/schema.sql)，一次建全所有表、RLS 与种子数据
- **已有数据库**：只执行增量迁移脚本，不要重跑全量文件

包含的数据表：

| 表/视图 | 用途 | 可见性 |
| --- | --- | --- |
| `authors` / `series` / `books` | 目录数据（含 5 位作者、4 个系列、10 本书的种子数据） | 公开可读 |
| `favorites` / `ratings` / `notes` / `shelf` | 用户个人数据 | 仅属主（RLS） |
| `profiles` | 评论者昵称，注册时由触发器自动建档 | 公开可读 |
| `reviews` | 公开书评，绑定 book_id + user_id | 公开可读，仅本人可写 |
| `rating_stats`（视图） | 聚合所有用户评分的平均分与人数 | 公开可读（GRANT） |

> 请勿删表重建，否则会丢失用户数据。

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`（本地无需提交）：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. 配置封面存储（可选）

1. Supabase 控制台 → Storage → New bucket，名称 `covers`，勾选 **Public bucket**
2. 将封面 URL 写入 `books.cover_url`
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
│   ├── page.tsx                        # 首页（案件档案时间线 + 筛选）
│   ├── search/page.tsx                 # 全局搜索页（需登录）
│   ├── books/[bookId]/reviews/page.tsx # 每本书的独立书评页
│   ├── shelf/page.tsx                  # 用户书架（收藏 + 阅读进度）
│   ├── login/page.tsx                  # 登录
│   ├── signup/page.tsx                 # 注册
│   ├── forgot-password/page.tsx        # 忘记密码
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
recommendation/                         # 推荐引擎（Python，离线运行）
├── config.py                           # 读取 .env 中的 Supabase 配置
├── data_loader.py                      # 拉取 ratings / books / authors
├── recommender.py                      # Item-Based 协同过滤核心算法
├── main.py                             # 命令行入口（--user-id --top-n）
├── test_data.py                        # 幂等创建测试用户与评分
└── cleanup_test_data.py                # 清理测试数据
```

## 开发提示

- 本项目使用 Next.js 16，`middleware` 已更名为 `src/proxy.ts`
- 改动类型或页面后，先运行 `npx next typegen` 再 `npx tsc --noEmit` 做类型检查
- 书评权限模型：所有人可读，登录用户可发表，仅作者本人可修改/删除
- `rating_stats` 是 security definer 视图，不支持 RLS；公开读取通过 `grant select to anon, authenticated` 授权
- 搜索页面需要登录，未登录访问会自动重定向到 `/login`

## 推荐引擎

独立于 Next.js 的离线 Python 模块，直接读取 Supabase 数据计算推荐：

```bash
cd recommendation
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r requirements.txt

# 配置 recommendation/.env（勿提交）：
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

python main.py --user-id <UUID> --top-n 5   # 为指定用户生成 Top-N 推荐
```

- 算法：Item-Based Collaborative Filtering（余弦相似度 + 加权平均预测）
- 冷启动保护：用户不存在 / 无评分 / 无候选书时返回对应状态而非报错
- 测试脚本：`python test_data.py` 幂等创建测试用户与评分；`python cleanup_test_data.py` 一键清理
