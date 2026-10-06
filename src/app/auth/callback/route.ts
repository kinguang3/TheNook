import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  LEGACY_VERIFIER_COOKIE,
  NOOK_PKCE_COOKIE,
} from "@/lib/pkce-recovery";

type CookieOptions = {
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
};

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function applyCookies(res: NextResponse, pending: PendingCookie[]) {
  for (const { name, value, options } of pending) {
    res.cookies.set(name, value, options);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const pending: PendingCookie[] = [];

  if (code) {
    // 恢复流程的 verifier 来自我们自持的 cookie；auth-js 读不到自己那份时，
    // 用自持值合成它要求的 legacy cookie（仅当真实 legacy 缺失才注入，
    // 避免干扰验证码/注册流程）
    let verifier: string | null = null;
    const nook = request.cookies.get(NOOK_PKCE_COOKIE)?.value;
    if (nook && /^[A-Za-z0-9_-]{43,128}$/.test(nook)) {
      verifier = nook;
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const base = request.cookies.getAll();
            if (
              verifier &&
              !base.some((c) => c.name === LEGACY_VERIFIER_COOKIE)
            ) {
              return [
                ...base,
                {
                  name: LEGACY_VERIFIER_COOKIE,
                  value: JSON.stringify(`${verifier}/recovery`),
                },
              ];
            }
            return base;
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              pending.push({
                name,
                value,
                options: options as CookieOptions,
              });
            }
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (verifier) {
        pending.push({
          name: NOOK_PKCE_COOKIE,
          value: "",
          options: {
            path: "/",
            maxAge: 0,
            httpOnly: true,
            sameSite: "lax",
            secure: true,
          },
        });
      }
      // 重置密码链接：verifier 带 recovery 标记，必须去设置新密码页
      // （运行时返回 redirectType，类型声明尚未暴露）
      const redirectType = (data as { redirectType?: string } | null)
        ?.redirectType;
      const safeNext = next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/";
      const dest = redirectType === "recovery"
        ? "/auth/reset-password"
        : safeNext;
      const res = NextResponse.redirect(`${origin}${dest}`);
      applyCookies(res, pending);
      return res;
    }
    const reason =
      (error as { code?: string }).code ?? error.name ?? "exchange-failed";
    const res = NextResponse.redirect(
      `${origin}/login?error=auth-callback-failed&reason=${encodeURIComponent(reason)}`,
    );
    applyCookies(res, pending);
    return res;
  }

  // GoTrue 对无效/过期/已用的链接：303 到 redirect_to?error=access_denied&error_code=...
  const goTrueError = searchParams.get("error_code") ?? searchParams.get("error");
  const reason = goTrueError ? `verify:${goTrueError}` : "missing-code";
  return NextResponse.redirect(
    `${origin}/login?error=auth-callback-failed&reason=${encodeURIComponent(reason)}`,
  );
}
