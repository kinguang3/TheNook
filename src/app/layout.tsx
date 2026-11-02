import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/supabase/server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { RecoveryWatcher } from "@/components/recovery-watcher";
import { Sidebar } from "@/components/sidebar";

// 仅自托管拉丁字形的小字体（mono 用于 UI 标签）；
// 中文衬线体已改为系统字体栈（见 globals.css 的 --font-serif），
// 不再自托管 Noto Serif SC 的大量 CJK woff2 子集。
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: "Casebook Timeline | 推理小说推荐与收藏",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: SITE_NAME,
    title: "Casebook Timeline | 推理小说推荐与收藏",
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Casebook Timeline | 推理小说推荐与收藏",
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout(props: LayoutProps<"/">) {
  const { user } = await getCurrentUser();

  return (
    <html lang="zh-CN" className={plexMono.variable}>
      <body>
        <a className="skip-link" href="#main-content">
          跳到主内容
        </a>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var w=Number(localStorage.getItem("sidebar-width"));if(w>=160&&w<=440)document.documentElement.style.setProperty("--sidebar-w",w+"px")}catch(e){}',
          }}
        />
        <RecoveryWatcher />
        <div className="app-shell">
          <Sidebar userEmail={user?.email ?? null} />
          <div className="app-main" id="main-content" tabIndex={-1}>
            {props.children}
            <footer className="site-footer">
              <p>Casebook Timeline</p>
              <p>推理小说阅读档案，2026</p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}