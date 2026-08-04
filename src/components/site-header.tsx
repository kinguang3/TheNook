import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="site-header">
      <div>
        <p className="eyebrow">[casebook/timeline]</p>
        <Link className="wordmark" href="/" aria-label="Casebook Timeline 首页">
          <span>CASEBOOK</span>
          <span>TIMELINE</span>
        </Link>
      </div>

      <nav className="site-nav" aria-label="主导航">
        <Link href="/#timeline">时间线</Link>
        <Link href="/#collection">我的收藏</Link>
        <Link href="/topic?type=author&id=keigo-higashino">作者专题</Link>

        {user ? (
          <>
            <span className="user-chip" data-testid="user-chip">
              [{user.email}]
            </span>
            <SignOutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="button-link">
              登录
            </Link>
            <Link href="/signup" className="button-link">
              注册
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}