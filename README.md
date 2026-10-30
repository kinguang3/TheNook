<div align="center">

# TheNook · Casebook Timeline

**一个专注于推理小说的发现与收藏平台**

以纵向时间线呈现的推理小说推荐站点 —— 浏览、收藏、评分、追踪阅读进度，并为每一本书写下公开书评。

Next.js 16 · React 19 · TypeScript · Supabase

</div>

---

## 功能特色

- **案件档案时间线**：作品按出版年份纵向展开，每本书分配与封面一致的 CASE 编号；年份栏带滚动阅读光束，随阅读进度点亮
- **墨色铅印视觉**：深色纸面 + 暖金强调色、系统中文字体栈、IBM Plex Mono 标签，全站叠加极轻的印刷颗粒
- **多维筛选系统**：按地区（欧美/日系）、年代（1980 前 - 2020s）、类型（本格推理/孤岛/连环杀手等）筛选书目
- **全局搜索**：单一输入框同时检索作者、书籍、时间线节点；关键词 250ms 防抖后写回 URL（`/search?q=`），可分享、可前进后退
- **公开书评**：每本书拥有独立书评页（`/books/<bookId>/reviews`），所有人可读，登录后可发表、编辑、删除自己的评论
- **书架**：收藏即上架，带真实封面（Supabase Storage）；阅读进度条自动推导未开始 / 阅读中 / 已读完
- **个人数据**：收藏、评分（1–5 星）、私人笔记持久化到 Supabase，仅本人可见（RLS）
- **读者综合评分**：聚合所有用户评分的平均分（`rating_stats` 视图），全站统一展示
- **可拖拽侧边栏**：宽度存 `localStorage`，首帧由内联脚本恢复，刷新不跳动
- **推荐算法（离线）**：Python 混合推荐 —— 共评余弦协同过滤（按共评人数置信收缩）+ 内容相似度（标签 / 作者 / 系列），自适应加权生成 Top-N 推荐
- **用户系统**：注册 / 登录 / 忘记密码（Supabase Auth，邮箱验证），会话自动刷新；重置采用 PKCE 流程——同一浏览器内验证状态由 Cookie 继承，也支持把一次性验证符带入邮件链接，跨设备/跨浏览器点击即可完成密码重设

> 未登录可浏览首页、专题与书评；`/search` 需要登录，书架为软提示。

## 快速开始

### 1. 环境要求

- Node.js 20.9+（Next.js 16 要求）
- 一个 [Supabase](https://supabase.com) 项目（免费档即可）

### 2. 初始化数据库

在 Supabase 控制台 → SQL Editor 中执行 SQL：

- **全新项目**：执行 [`supabase/schema.sql`](supabase/schema.sql)，一次建全所有表、RLS、触发器、聚合视图与种子数据
- **已有数据库**：只执行增量迁移脚本，不要重跑全量文件

包含的数据表：

| 表/视图 | 用途 | 可见性 |
| --- | --- | --- |
| `authors` / `series` / `books` | 目录数据（8 位作者、4 个系列、13 本书） | 公开可读 |
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

同时把 `next.config.ts` 的 `images.remotePatterns[0].hostname` 改成你的 Supabase 项目域名，否则封面图会被图片优化器拒绝。

### 4. 配置封面存储

1. Supabase 控制台 → Storage → New bucket，名称 `covers`，勾选 **Public bucket**
2. 上传封面后，将公开 URL 写入 `books.cover_url`，CASE 编号写入 `books.cover_mark`
3. 时间线卡片的 CASE 序号直接取自 `cover_mark`，与封面印刷编号保持一致
4. 无封面时页面自动回退为色块 + 编号样式

> 本仓库的 `cover/` 目录存放全部封面原图与 `manifest.json` 映射（该目录已被 gitignore，不随仓库分发）。

### 5. 启动

```bash
npm install
npm run dev        # http://localhost:3000
```

生产构建：

```bash
npm run build
npm start
```

## 项目结构

```
src/
├── app/
│   ├── layout.tsx                      # 根布局（侧边栏、页脚、颗粒/宽度启动脚本）
│   ├── page.tsx                        # 首页（案件档案时间线 + 筛选）
│   ├── error.tsx / not-found.tsx       # 路由级错误与 404 兜底
│   ├── topic/page.tsx                  # 作者 / 系列专题（/topic?type=author|series&id=）
│   ├── search/page.tsx                 # 全局搜索页（需登录）
│   ├── books/[bookId]/reviews/page.tsx # 每本书的独立书评页
│   ├── shelf/page.tsx                  # 用户书架（收藏 + 阅读进度）
│   ├── login / signup / forgot-password / auth/reset-password
│   ├── auth/callback/route.ts          # 邮箱验证 / 密码重置回调（PKCE 兑换）
│   ├── actions/                        # Server Actions（auth / user-data / shelf / reviews）
│   └── globals.css                     # 全站样式（无 UI 框架）
├── components/
│   ├── sidebar.tsx                     # 可拖拽宽度的侧边导航
│   ├── home-client.tsx                 # 时间线、筛选、排序、阅读光束
│   ├── search-client.tsx               # 客户端检索与 URL 同步
│   ├── shelf-client.tsx                # 书架进度与状态
│   ├── reviews-client.tsx              # 书评列表 / 编辑 / 删除
│   ├── user-rating.tsx                 # 1–5 星评分
│   ├── auth-forms.tsx                  # 登录 / 注册 / 忘记密码 / 设置新密码
│   ├── sign-out-button.tsx
│   └── recovery-watcher.tsx            # 客户端兜底：拦截 ?code= / #error_code= 并转交服务端
├── lib/
│   ├── supabase/                       # 服务端（cookie 会话）/ 浏览器客户端
│   ├── pkce-recovery.ts                # 密码重置 PKCE 工具（验证符 / 挑战 / Cookie 名）
│   ├── data.ts                         # 数据读取与缓存边界
│   └── types.ts                        # 领域类型
└── proxy.ts                            # 会话刷新代理（Next.js 16 替代 middleware）
supabase/schema.sql                     # 全量建表 + RLS + 触发器 + 种子数据 + 聚合视图
recommendation/                         # 推荐引擎（Python，离线运行）
├── config.py                           # 读取 .env 中的 Supabase 配置
├── data_loader.py                      # 分页拉取 ratings / books / authors（带网络重试）
├── recommender.py                      # 混合推荐核心算法（CF 收缩 + 内容相似）
├── main.py                             # 命令行入口（--user-id --top-n）
├── test_data.py                        # 幂等创建测试用户与评分
├── cleanup_test_data.py                # 清理测试数据
├── verify_algo.py                      # 算法回归验证（含边界场景）
└── stress_test.py                      # 随机压力测试（12 项检查）
```

> `public/` 下的 `index.html` / `app.js` 等是早期静态原型，线上路由不使用。

## 性能与缓存

- **公开数据缓存**：`authors` / `series` / `books` 缓存 10 分钟，`rating_stats` 与书评缓存 5 分钟；统一走匿名客户端 + `unstable_cache`，标签为 `catalog` / `rating-stats` / `reviews`
- **写后即时失效**：评分后 `updateTag("rating-stats")`，书评增改删后 `updateTag("reviews")`；目录更新用 `revalidateTag("catalog")` 或重新部署
- **用户数据按需查**：首页只查收藏、专题只查笔记、书架查书架 + 收藏、书评页只查当前这本书的评分，避免一页拉三张表
- **搜索不跑服务端**：命中缓存的目录数据一次性下发，客户端即时过滤；URL 用 `history.replaceState` 同步，不触发 RSC 往返
- **会话与身份**：`src/proxy.ts` 用 `getClaims()` 校验 JWT 并刷新过期会话，验签后把用户写入内部请求头（同名客户端头会被剥离）；`getCurrentUser()`（React `cache`）直接复用，头缺失才回退 `getUser()`，登录态页面因此少一次 Auth 往返
- **图片与字体**：`next/image` + AVIF/WebP，`sizes` 按真实渲染宽度设置；中文走系统字体栈，仅自托管 IBM Plex Mono 拉丁子集
- **动效零依赖**：印刷颗粒与时间线阅读光束均为纯 CSS / 原生 JS，未引入 Tailwind 或 framer-motion

## 开发提示

- 本项目使用 Next.js 16，`middleware` 已更名为 `src/proxy.ts`；不要改回 `getSession()`，它不校验 JWT
- 改动类型或页面后，先运行 `npx next typegen` 再 `npx tsc --noEmit`；提交前跑一遍 `npm run build`
- 书评权限模型：所有人可读，登录用户可发表，仅作者本人可修改/删除
- 时间线 CASE 编号来自 `books.cover_mark`，新增书籍时需同步更新该字段与封面编号
- `rating_stats` 是普通视图，不支持 RLS；通过 `grant select to anon, authenticated` 只暴露聚合值（平均分 + 人数）
- 搜索页面需要登录，未登录访问会自动重定向到 `/login`
- 配置 Supabase Auth 时，**Redirect URLs** 必须包含 `NEXT_PUBLIC_SITE_URL/auth/callback` 与 `NEXT_PUBLIC_SITE_URL/auth/callback*`（邮件里还会带 `?nk=` 参数），否则验证 / 重置邮件会落回首页
- 重复注册不会提示「邮箱已存在」（防枚举）；未验证账号会重发确认信，已确认账号则静默不发。登录未验证账号也会自动补发，提示文案保持中性
- 忘记密码的跨设备支持：`lib/pkce-recovery.ts` 会把一次性验证符放入邮件链接，回调优先用它完成兑换
- 仓库暂未配置 ESLint / 测试脚本；质量门槛目前是 `tsc` + `next build` + 路由回归

## 部署

1. Vercel 导入仓库，配置 `.env.example` 中的三项环境变量（`NEXT_PUBLIC_SITE_URL` 用正式域名）
2. Supabase → Authentication → URL Configuration：Site URL 填正式域名，Redirect URLs 加上回调与重置页
3. `vercel.json` 已把函数区域固定在 `hkg1`（新加坡），与 Supabase 项目区域保持一致以降延迟

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

- 算法：混合推荐 —— CF 相似度只在共同评分者维度计算并按 `n/(n+10)` 置信收缩；无共评者时回退到内容相似度（标签 Jaccard 50% + 同作者 30% + 同系列 20%）；预测全并列时按内容亲和度排序兜底
- 冷启动保护：用户不存在 / 无评分 / 无候选书时返回对应状态而非报错；数据稀疏时内容信号保证仍能出推荐
- 质量保障：`python verify_algo.py` 算法回归验证；`python stress_test.py` 随机压力测试（值域、泄漏、确定性等 12 项检查）
- 测试脚本：`python test_data.py` 幂等创建测试用户与评分；`python cleanup_test_data.py` 一键清理
