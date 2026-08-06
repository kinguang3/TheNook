# 部署知识库（Knowledge Base）

本知识库汇总本网站从开发到上线的全链路知识：**Next.js + Supabase + Vercel + Cloudflare + GitHub**。

---

## 1. 整体架构

```
浏览器用户
   │
   ├─ https://thenook.cc.cd ── Cloudflare DNS（DNS Only，仅解析）
   │
   └─ Vercel Edge/Server（Next.js 16.3，托管于 vercel.app）
        ├─ 服务端渲染页面（/、/topic、/login、/signup）
        ├─ Auth 回调 /auth/callback
        └─ Supabase（PostgreSQL + Auth + RLS）
             ├─ public.authors / series / books（目录数据，公开读）
             └─ public.favorites / ratings / notes（用户数据，仅本人）
```

链路要点：
- **Cloudflare 只做 DNS 解析**（DNS Only，橙云关闭），实际流量直达 Vercel。
- **Supabase 只存数据和认证**，业务逻辑全部在 Next.js 服务端执行。
- 页面为动态渲染（ƒ Dynamic），数据每次请求时从 Supabase 读取，无需重新构建即可看到数据库改动。

---

## 2. 本地开发

### 2.1 环境要求
- Node.js ≥ 20（项目使用 Next.js 16.3，含破坏性变更，见 AGENTS.md 提示）。
- `npm install` 安装依赖。

### 2.2 环境变量（.env.local）
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
> 注意：`NEXT_PUBLIC_` 前缀的变量会被打包进浏览器端代码，只能在 Supabase 客户端使用；真实控制逻辑在服务端，靠 RLS 兜底。

### 2.3 常用命令
| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发（默认 http://localhost:3000） |
| `npm run build` | 生产构建（含 TypeScript 检查，**部署前必跑**） |
| `npm start` | 运行生产构建产物 |

---

## 3. Supabase（数据库 + 认证）

### 3.1 表结构与 RLS
`schema.sql` 维护两份数据：
- **目录数据**（authors / series / books）：公开可读，`select` 策略 `using (true)`。
- **用户数据**（favorites / ratings / notes）：以 `auth.uid() = user_id` 限制，只能操作自己的行，主键为 `(user_id, book_id)`。

关键原则：**表数据写死权限（RLS），前端拿 anon key 也只能读到允许的数据**。

### 3.2 执行 SQL 的正确姿势（幂等）
完整重跑 `schema.sql` 会报错：`policy ... already exists`（42710）。
正确做法：
- 只执行**增量语句**，全部写成幂等：
  ```sql
  alter table public.books add column if not exists cover_url text not null default '';
  ```
- 更新种子数据用 `update ... from (values ...)` 批量补，不要删表重建（会丢用户数据）：
  ```sql
  update public.books set cover_url = v.cover_url
  from (values
    ('journey-under-the-midnight-sun', 'https://.../s4610502.jpg')
  ) as v(id, cover_url)
  where public.books.id = v.id;
  ```

### 3.3 认证配置（Auth → URL Configuration）
- **Site URL**：`https://thenook.cc.cd`（生产域名）。
- **Redirect URLs**：`https://thenook.cc.cd/auth/callback`。
- 注册为邮箱+密码，需**邮箱验证**后才能登录（邮件里的回跳地址由 `NEXT_PUBLIC_SITE_URL` 拼接，见 `src/app/actions/auth.ts`）。
- 查看注册用户：Dashboard → Authentication → Users；用户数据在 Table Editor。

### 3.4 常见坑
- 改域名后**必须同步**：Vercel 环境变量 → Supabase Site/Redirect URL →（GitHub 仓库 About 可选）。
- `NEXT_PUBLIC_SITE_URL` 指向新域名后需在 Vercel **重新部署**才生效（环境变量是构建时注入）。

---

## 4. Vercel（部署平台）

### 4.1 部署方式
- 关联 GitHub 仓库后**每次 push 自动构建部署**，无需手动操作。
- 构建命令与 Node 版本在项目设置里可覆盖（默认即可）。

### 4.2 环境变量（Production）
| 变量 | 值（示例） |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://exixzgnhsyjnsrgzhrct.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` |
| `NEXT_PUBLIC_SITE_URL` | `https://thenook.cc.cd` |

> 环境变量**区分环境**（Production/Preview/Development），改完必须 Redeploy 一次。

### 4.3 域名绑定
路径：项目 → Settings → Domains（在项目导航标签里，不在 General 里）。
- 添加主域名 + `www` 子域名两条。
- 状态说明：
  - **Valid Configuration** = 域名解析正确，已完成。
  - **DNS Change Recommended** = Vercel 检测到根域名不是标准 A 记录（如 Cloudflare CNAME 扁平化），只是提示，也可以按提示在 Cloudflare 把根域名删掉重建为 **A 记录**（Cloudflare 不允许修改 Type，只能删了重建）。

---

## 5. Cloudflare（DNS 托管）

### 5.1 记录配置（DNS Only，灰云）
| 类型 | 名称 | 内容 | 说明 |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` | 子域名指向 Vercel |
| A | `@` | `76.76.21.21`（Vercel 推荐值） | 根域名指向 Vercel 服务器 |

- 根域名也可以直接 CNAME（Cloudflare 的 CNAME 扁平化会自动解析成 A 记录，Vercel 首页域名列表里仍会显示 "DNS Change Recommended"，不影响访问）。
- **DNS Only（灰云）**：免费套餐无法给非 Cloudflare 托管站点开启代理（橙云会 520/522）。
- 生效验证：`nslookup` / 浏览器访问；CNAME 生效一般分钟级。

### 5.2 常见坑
- Cloudflare 记录**不能修改 Type**，改类型 = 删记录重建（同一条记录重建即可，不影响已生效状态）。
- Vercel 给出的 A 记录 IP 可能因区域/时间不同，以 Vercel 首页推荐值为准。

---

## 6. Git / GitHub

### 6.1 提交流程
```bash
git add -A
git commit -m "描述性提交信息"
git push
```
提交信息遵循仓库既有风格（如 `Add book cover images from Douban via cover_url column`）。

### 6.2 常见网络问题
- `Failed to connect to github.com port 443` / `Recv failure: Connection was reset`：网络对 GitHub 443 端口不稳定，**直接重试 2-3 次**即可（本机多次出现，重试均成功）。
- 推送前先 `git status` / `git diff` 确认只含预期改动，**不要提交 `.env.local` 等密钥文件**（已在 .gitignore）。

---

## 7. 本项目前端实现要点

### 7.1 数据流
- 页面在服务端用 `createClient`（`src/lib/supabase/server.ts`）拉取目录数据，渲染时把 `Book` 类型映射为驼峰字段（`src/lib/data.ts`）。
- 用户收藏/评分/笔记通过 `src/app/actions/user-data.ts` 以 Server Action 写库。
- 新增数据库字段的完整链路：`schema.sql` 加列 → `types.ts` 加类型 → `data.ts` 加映射 → 组件渲染 → CSS 样式。

### 7.2 封面外链
- `books.cover_url` 存豆瓣封面图 URL（`img*.doubanio.com`），渲染时 `<img loading="lazy" class="cover-image">` 绝对定位铺满 `.cover-block`（`object-fit: cover`）。
- **取图技巧**：豆瓣书页 `https://book.douban.com/subject/<id>/` 的 HTML 里有 `og:image` 元标签，直接抓即可拿到封面直链；PowerShell 抓取需带浏览器 UA 头，中文需按 UTF-8 解码（`Invoke-WebRequest -UseBasicParsing`）。
- 封面加载失败时页面仍保留原有色块背景 + 编号，不破版。

### 7.3 脚印动画（重要修复）
- 背景脚印层必须用 **`createPortal` 渲染到 `document.body`**：若放在居中的 `.page-shell`（max-width 1100px）内，全视口坐标会被 `overflow:hidden` 裁掉导致脚印消失。
- 动画平滑：落步位置记录 `prevCx`，按 `stepFrac = gaitMs / STEP_MS` 做**步间线性插值**；每帧用 `translate3d(...) rotate(...)` 合成器属性（不要用 `left/top` 逐帧改）。
- 代码：`src/components/footprints-layer.tsx`；含 `mounted` 状态避免 SSR 水合不一致。

### 7.4 路由与安全
- `/api/debug-env` 这类**会暴露环境变量信息的调试路由用完即删**（曾添加后已移除）。
- 邮箱回跳地址只应来自 `NEXT_PUBLIC_SITE_URL`，不要硬编码。

---

## 8. 故障排查速查表

| 现象 | 原因 | 处理 |
|---|---|---|
| 邮件验证/登录跳转地址是旧域名 | `NEXT_PUBLIC_SITE_URL` 未改/未重部署 | 更新 Vercel 变量 → Redeploy |
| 注册后收不到邮件或回调失败 | Supabase Redirect URL 缺 `/auth/callback` | Auth → URL Configuration 补全 |
| 首页/专题页无封面 | 数据库缺 `cover_url` 列或值为空 | 执行幂等 `alter table ... if not exists` + `update` |
| 背景脚印消失 | 图层渲染在 `overflow:hidden` 容器内 | 改 `createPortal` 到 body |
| 脚印一顿一顿 | 逐帧 `left/top` 定位 | 改插值 + `translate3d` |
| GitHub push 超时/重置 | 网络到 443 端口不稳定 | 重试 2-3 次 |
| Vercel 域名提示 DNS Change Recommended | 根域名非 A 记录（CNAME 扁平化） | 忽略或删记录重建为 A |
| 重跑 schema.sql 报 policy already exists | 表/策略已存在 | 只执行幂等增量语句 |

---

## 9. 关键入口速查

| 平台 | 入口 | 用途 |
|---|---|---|
| Supabase | Dashboard → SQL Editor | 执行数据库脚本 |
| Supabase | Authentication → URL Configuration | 站点与回调 URL |
| Supabase | Table Editor / Authentication → Users | 查用户数据 |
| Vercel | 项目 → Settings → Domains | 域名绑定 |
| Vercel | 项目 → Settings → Environment Variables | 环境变量 |
| Cloudflare | DNS → Records | DNS 记录管理 |
| GitHub | 仓库 → About（齿轮） | 设置仓库主页链接 |
