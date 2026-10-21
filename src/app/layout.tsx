import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/supabase/server";
import { RainLayer } from "@/components/rain-layer";
import { RecoveryWatcher } from "@/components/recovery-watcher";
import { Sidebar } from "@/components/sidebar";

// 仅自托管拉丁字形的小字体（mono 用于 UI 标签）；
// 中文衬线体已改为系统字体栈（见 globals.css 的 --font-serif），
// 不再自托管 Noto Serif SC 的大量 CJK woff2 子集。
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Casebook Timeline | 推理小说推荐与收藏",
  description:
    "一个以纵向时间线呈现的推理小说推荐与收藏网站，支持标签筛选、收藏、评分与专题聚合。",
};

export default async function RootLayout(props: LayoutProps<"/">) {
  const { user } = await getCurrentUser();

  return (
    <html lang="zh-CN" className={plexMono.variable}>
      <body>
        <RainLayer />
        <RecoveryWatcher />
        <div className="app-shell">
          <Sidebar userEmail={user?.email ?? null} />
          <div className="app-main">
            {props.children}
            <footer className="site-footer">
              <p>[x] Casebook Timeline / Suspense reading log / 2026</p>
              <p>为可读性而设计，特效只负责营造气氛。</p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}