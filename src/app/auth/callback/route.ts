import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  let reason = "exchange-failed";
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 重置密码链接：verifier 带 recovery 标记，必须去设置新密码页
      // （运行时返回 redirectType，类型声明尚未暴露）
      const redirectType = (data as { redirectType?: string } | null)
        ?.redirectType;
      if (redirectType === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    reason = (error as { code?: string }).code ?? error.name ?? "exchange-failed";
  } else {
    // GoTrue 对无效/过期/已用的链接：303 到 redirect_to?error=access_denied&error_code=...
    const goTrueError = searchParams.get("error_code") ?? searchParams.get("error");
    reason = goTrueError ? `verify:${goTrueError}` : "missing-code";
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth-callback-failed&reason=${encodeURIComponent(reason)}`,
  );
}