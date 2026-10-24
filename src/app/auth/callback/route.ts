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
    // verifier 优先级：链接自带的 nk（忘记密码）> auth-js 自己的 legacy
    // cookie（注册/魔法链接）> 自持 cookie（忘记密码兜底）。自持 cookie
    // 只在 auth-js 完全没有 verifier 时才用，且 nk 需要覆盖残留的
    // legacy（否则会拿注册的 verifier 去兑换重置码）
    let verifier: string | null = null;
    let fromLink = false;
    const legacyVerifier = request.cookies.get(LEGACY_VERIFIER_COOKIE)?.value;
    const nk = searchParams.get("nk");
    if (nk && /^[A-Za-z0-9_-]{43,128}$/.test(nk)) {
      verifier = nk;
      fromLink = true;
    } else if (!legacyVerifier) {
      // 仅当 auth-js 自己没有 verifier 时才用自持 cookie，避免把
      // 早先忘记密码留下的 verifier 套到注册/魔法链接的兑换上
      const nook = request.cookies.get(NOOK_PKCE_COOKIE)?.value;
      if (nook && /^[A-Za-z0-9_-]{43,128}$/.test(nook)) {
        verifier = nook;
      }
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const base = request.cookies.getAll();
            if (!verifier) return base;
            // 链接自带 nk 时以它为准（覆盖可能残留的旧 verifier）；
            // 否则只在 auth-js 完全没有 verifier 时补位
            if (!fromLink && legacyVerifier) return base;
            return [
              ...base.filter((c) => c.name !== LEGACY_VERIFIER_COOKIE),
              {
                name: LEGACY_VERIFIER_COOKIE,
                value: JSON.stringify(`${verifier}/recovery`),
              },
            ];
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
      // 兑换成功后自持 verifier 已无用（下一次忘记密码会重新生成），
      // 无论来自链接还是 cookie 都清掉，避免残留值干扰后续注册/魔法链接
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
    // 幂等兜底：callback URL 被重复访问（刷新/回退/重复点击，或
    // 邮箱安全预取已先行兑换销毁了 flow state/verifier cookie）时，
    // exchange 会报 flow_state_not_found 或 verifier 缺失；但本浏览器
    // 若已持有成功兑换签发的会话，直接进设置密码页即可——有会话就能改密码
    if (
      reason === "flow_state_not_found" ||
      reason === "flow_state_expired" ||
      reason === "invalid_grant" ||
      reason === "pkce_code_verifier_not_found" ||
      reason === "AuthPKCECodeVerifierMissingError"
    ) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const res = NextResponse.redirect(`${origin}/auth/reset-password`);
        applyCookies(res, pending);
        return res;
      }
    }
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
