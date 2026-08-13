import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { RainLayer } from "@/components/rain-layer";
import { Sidebar } from "@/components/sidebar";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Casebook Timeline | 推理小说推荐与收藏",
  description:
    "一个以纵向时间线呈现的推理小说推荐与收藏网站，支持标签筛选、收藏、评分与专题聚合。",
};

export default async function RootLayout(props: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="zh-CN" className={plexMono.variable}>
      <body>
        <RainLayer />
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