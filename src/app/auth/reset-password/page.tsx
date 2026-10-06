import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "设置新密码 | Casebook Timeline",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const cookieStore = await cookies();
    const hasSessionCookie = cookieStore
      .getAll()
      .some(
        (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
      );
    return (
      <main className="auth-wrap">
        <div className="auth-card">
          <p className="eyebrow">[!] Invalid Link</p>
          <h1>链接无效或已过期</h1>
          <p className="auth-error" role="alert">
            {hasSessionCookie
              ? "浏览器已收到重置会话，但验证失败（Cookie 可能已过期或被清除）。请重新发送重置链接。"
              : "重置链接只能使用一次，且有效期约 1 小时。请回到忘记密码页面重新发送。"}
          </p>
          <p className="auth-switch">
            <Link href="/forgot-password">重新发送重置链接</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <ResetPasswordForm />
    </main>
  );
}
