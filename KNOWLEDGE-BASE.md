# Knowledge Base

本文件沉淀本项目（TheNook / Casebook Timeline）开发中积累的、可复用的知识点：部署链路、Next 16 的坑与 API 变化、数据层设计原则、性能优化路线。与代码细节相关的结论都会标注文件位置。

---

## 1. 域名 / DNS / CDN / 无服务器函数的关系

一次网页请求的真实链路（本项目实例）：

```
用户浏览器
  │  ① 域名（thenook.cc.cd）— 只是个名字，不执行任何代码
  │  ② DNS 解析 — 把域名翻译成 IP（A 记录 → 216.198.79.1）
  ▼
Vercel CDN / Edge（anycast 边缘，全球 100+ PoP）
  │     —— 终止 TLS、派发可缓存的静态内容、把动态请求转发
  ▼   （若命中缓存，到此为止直接返回）
Vercel Functions（无服务器函数，固定区域执行）
  │     —— 你的 src/ 代码在这里运行：渲染页面、查数据库
  ▼
Supabase（Postgres + Auth + Storage，前面还有 Cloudflare）
```

### 各层职责速记

| 层 | 做什么 | 不做什么 |
| --- | --- | --- |
| 域名 | 门牌号，供 DNS 查询 | 不执行代码、不产生主要延迟 |
| DNS | 名字 → IP（记录类型：A 直给 IP / CNAME 指向域名 / NS 换托管商） | 不决定代码在哪跑 |
| CDN / Edge | TLS 终止、静态缓存、就近接入、动态请求路由 | 缓存未命中时不拦截 |
| Functions | 真正执行「渲染 + 查库」的无服务器运行时 | 默认只在**一个区域**跑 |

### 怎么验证函数在哪个区域跑

响应头 `x-vercel-id` 格式为 `<边缘节点>::<函数区域>::<请求ID>`。

- 改区域前实测：`hkg1::iad1::...`（用户进香港边缘，函数在**美东**执行 → 跨洋）
- 改区域后实测：`hkg1::hkg1::...`（都在香港）

判断页面对不对：首页这类动态页会带 `x-vercel-cache: MISS` + `cache-control: no-store`；命中 CDN 缓存时这里会变 HIT。

### 本项目函数区域：iad1 → hkg1

- Vercel 新项目默认函数区是 `iad1`（美东），Vercel 官方建议「函数应尽量与数据库同区」，但我们用户在大陆，所以选 `hkg1`。
- 19 个可选区域，常用：`hkg1` 香港、`sin1` 新加坡、`hnd1` 东京、`iad1` 美东、`sfo1` 美西。
- **函数区域不影响静态资源**：JS/CSS/字体默认全球分发，改区域只影响动态渲染位置。
- 区域代码 `216.198.79.1`（域名 A 记录）不是 Vercel 官方常见 IP 段，但头部确认由 Vercel 服务。

---

## 2. 改函数区域的两种方式（推荐 vercel.json）

| | Vercel 控制台 | vercel.json |
| --- | --- | --- |
| 位置 | 项目 Settings → Functions → Function Regions | 仓库根目录配置文件 |
| 粒度 | 只能全局 | 可全局（`regions`），也可逐函数（`functions` 键） |
| 版本管理 | 否，配置孤悬在平台上 | 是，可 review、可复现 |
| 生效方式 | 改完需手动触发重部署 | push 自动部署时生效 |

本项目采用 **vercel.json**（仓库根目录）：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["hkg1"]
}
```

配合「push → Vercel 自动部署」的协作流，改区域和重新部署一次完成。逐函数写法（本项目不需要）形如：

```json
{ "regions": ["iad1"], "functions": { "api/eu.js": { "regions": ["cdg1"] } } }
```

> 注意：`preferredRegion`（路由文件里 export 的那个）在本项目用的 Next 16 **已废弃**，不要再写。Hobby 计划只能选单区域。

---

## 3. 本地代理隧道（重要排障经验）

`127.0.0.1:12000` 是本机代理程序（VPN/加速器）的监听端口。curl 加 `-x http://127.0.0.1:12000` 即把流量交给它出境：

```
curl/浏览器 → 127.0.0.1:12000（本地代理）→ 境外服务器 → 目标站点
```

典型用途：直连被墙/被 DNS 污染时绕路。**代价是每跳多一跳，且为所有测量引入额外延迟**。

### 三条经验教训

1. **代理挂掉 ≠ 站点挂掉**。代理故障时所有目标（连 google.com）都会 2 秒左右返回 `000`。排障第一步永远是拿一个已知可达的站点（google）做 sanity check，再判断是「我的链路」还是「站点」的问题。
2. **归因要分离**。本项目某次「直连突然通了」发生在改函数区域的同一时段，但两者无因果关系：vercel.json 只改函数区域，不碰 DNS 和网络；直连通畅是网络环境自愈。
3. **通过代理测出来的 TTFB 偏高**。曾经测得首页 5.7s（走挂掉的边缘代理）+ 忽快忽慢 4.6~15s，直连重测稳定在 0.74~0.89s。做性能对比时务必固定「同一条链路」测量。

### PowerShell 传参坑（踩过）

`-x http://127.0.0.1:12000` 存进变量再展开会变成一个含空格的**单个参数**，curl 解析出带空格的代理地址 → 静默失败（`000`、耗时 0.000x）。

```powershell
# ✉ 错误：$px = '-x http://127.0.0.1:12000'
# ✅ 正确：内联写成两个 token
curl.exe -s -o NUL -x http://127.0.0.1:12000 -w '%{time_starttransfer} %{http_code}' 'https://...'
```

---

## 4. 本项目网络可达性事实（2026-10 实测）

| 目标 | 直连 | 走代理（12000） |
| --- | --- | --- |
| thenook.cc.cd（Vercel 香港/新加坡边缘） | 通，TTFB ~0.8s | 代理挂时不通 |
| Supabase（exixzgnhsyjnsrgzhrct） | 不通（`000`） | 通，TTFB ~0.8s |

含义：**本机 `next start` 渲染必须给 Node 进程配代理环境变量**（`HTTP_PROXY` / `HTTPS_PROXY`），否则本地开发页全 502；Vercel 云端访问 Supabase 正常，不受影响。Supabase 走 Cloudflare，边缘在 HKG（响应头 `CF-RAY: xxxx-HKG`）。

```powershell
$env:HTTP_PROXY='http://127.0.0.1:12000'; $env:HTTPS_PROXY='http://127.0.0.1:12000'
Start-Process -FilePath node -ArgumentList 'node_modules\next\dist\bin\next','start','-p','3199' -WorkingDirectory 'D:\For_Test'
```

> `Start-Process` 传 `-p 3199` 会被 PowerShell 的参数名解析（`-PassThru/-PipelineVariable/-FilePath`）干扰，必须用显式 `ArgumentList`。

---

## 5. Next.js 16.3 与旧版训练数据的差异（重要）

本项目 AGENTS.md 要求「这不是你认识的 Next.js」，实际确认过的差异：

| 主题 | 旧认知 | Next 16 实际 |
| --- | --- | --- |
| 缓存 API | `unstable_cache` 是主力 | 仍可用但已 deprecated，被 `use cache` 指令取代；官方建议启用 Cache Components（`cacheComponents: true` + `cacheLife`/`cacheTag`），代价是切换到 PPR 渲染模型 |
| `revalidateTag` | 一个字符串参数 | **必须两个参数** `revalidateTag(tag, profile)` |
| 写后立即可读 | 没有专门 API | Server Action 内用 **`updateTag(tag)`**（本项目评分写入后失效聚合缓存用它） |
| 路由级函数区域 | `export const preferredRegion` | **已废弃**，区域走 `vercel.json` 或 Vercel 控制台 |
| middleware | `middleware.ts` | 已改名 `src/proxy.ts` |
| 官方文档位置 | 在线 | 随包分发：`node_modules/next/dist/docs/`，改代码前先读 |

缓存函数（`unstable_cache` 包裹的）**不能访问 `cookies()` / `headers()`**（缓存是跨用户共享的）。因此公共目录数据必须用「无 Cookie 的匿名 Supabase 客户端」读取（`src/lib/data.ts` 的 `publicClient()`），用户私有数据则保持带会话客户端、按请求查询。

判定原则：**能被很多人共享且不常变的数据 → 缓存；属于单个用户或需要实时 → 不缓存。**

---

## 6. 数据层设计（src/lib/data.ts）

### 分层

- **目录数据（可缓存）**：`getAuthors` / `getSeries` / `getBooks` / `getRatingStats`
  - `unstable_cache` 包裹，目录 10 分钟、评分聚合 5 分钟
  - 标签：`catalog`（目录）/ `rating-stats`（评分聚合），供按需失效
  - 内部用匿名客户端，`fetchBooks` 一次性并行取三张表再在内存拼装
- **用户数据（不缓存）**：`getUserData`（收藏/评分/笔记）、`getShelfData`（书架）、`getReviewsByBook`（书评）
  - 全程带 `supabase` 客户端参数，由页面把带会话的客户端传进来

### 失效联动

- `setRating`（`src/app/actions/user-data.ts`）写入成功后调用 `updateTag("rating-stats")`，让全站平均分立即刷新，而不是等 5 分钟窗口。
- 目录有更新（换种子数据）时同理 `revalidateTag("catalog", ...)` 或重新部署。

### Server Action 健壮性约定（对齐 actions/reviews.ts）

- 所有 mutate（insert/update/delete/upsert）之后**必须解构 `error` 并返回中文提示**，不允许静默吞错后当作成功返回旧数据。
- 服务端必须重新校验入参，不信客户端：评分限 1-5 整数（`user-data.ts`）、进度限 0-100 有限数、阅读状态白名单（`shelf.ts`）、评论长度（`reviews.ts`）。

---

## 7. 性能优化路线与进度

背景：站点用户在大陆，历史 TTFB 曾 5.7s（函数在美东 + 每请求全量查库 + 代理链路）。

| # | 项目 | 做法 | 状态 |
| --- | --- | --- | --- |
| 1 | 函数区域 hkg1 | `vercel.json` `regions: ["hkg1"]` | ✅ 已生效（`x-vercel-id` 验证 `hkg1::hkg1`） |
| 2 | 目录数据缓存 | `unstable_cache` + 匿名客户端 + `updateTag` 失效（见第 6 节） | ✅ 代码完成，待线上验证 |
| 3 | 图片体积 | `topic/page.tsx`、`search-client.tsx`、`shelf-client.tsx` 三处仍是裸 `<img>`，封面原图 ~2.3MB PNG；改为 `next/image`（走 Vercel 自动转 AVIF/WebP + 按 sizes 缩放），长期是把 covers 桶压成 WebP | ⬜ 待办 |
| 4 | 字体 | `layout.tsx` 的 `Noto_Serif_SC` 经 next/font 自托管大量 CJK woff2 子集（首页 `<link rel=preload>` 4 个）；改为系统字体栈，保留 `IBM_Plex_Mono` | ⬜ 待办 |
| 5 | 流式渲染 | 用户相关区块套 `<Suspense>`，页面壳先到、数据后流 | ⬜ 待办 |

### 大方向（未排期）

推荐算法上线到产品（Python 离线推荐已有算法与测试，缺页面入口）、书籍详情页拆分、豆瓣书单导入、自定义 SMTP 发件域名（提升重置邮件到达率）。

---

## 8. 环境与工具速查

- **Shell**：Windows PowerShell 5.1。无 `&&`（用 `;` 或 `cmd1; if ($?) { cmd2 }`）；`curl` 一律写 `curl.exe`；没有 `rg`（用 grep 工具或 `Select-String`）。
- **PowerShell 抓包**：`Select-String -Path f -Pattern "..."`；读文本用 `Get-Content -Raw -Encoding UTF8`（控制台中文显示乱码是显示问题，文件本身 UTF-8 正常）。
- **临时目录**：`C:\Users\54863\AppData\Local\Temp\opencode`。
- **本项目关键标识**：Supabase ref `exixzgnhsyjnsrgzhrct`（anon `sb_publishable_...`，勿提交 service role）；GitHub `kinguang3/TheNook.git`；生产域名 `https://thenook.cc.cd`。
- **约定**：未经允许不推送、不发送真实邮件；密码重置的 E2E 只能用户在浏览器真点邮件链接完成。
