import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_USER_EMAIL_HEADER,
  SESSION_USER_ID_HEADER,
} from "@/lib/auth-session";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function proxy(request: NextRequest) {
  const pendingCookies: PendingCookie[] = [];
  let cookieHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          pendingCookies.push(...cookiesToSet);
          // 新版 @supabase/ssr 会附带 no-store 响应头，避免带会话的响应被 CDN 缓存
          cookieHeaders = { ...cookieHeaders, ...headers };
        },
      },
    },
  );

  // 官方 Next.js SSR 集成推荐用 getClaims：校验 JWT 的同时顺带刷新过期会话
  // （非对称签名下本地验签，对称密钥时自动回退 getUser）。
  let claims: { sub?: string; email?: unknown } | undefined;
  try {
    const { data } = await supabase.auth.getClaims();
    claims = data?.claims;
  } catch {
    // 验签/刷新临时失败时按未登录处理：不阻断页面渲染，RSC 会回退到 getUser 兜底
  }

  // 用户头必须由 proxy 重新生成：先删掉客户端可能伪造的值，验签通过再写回。
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(SESSION_USER_ID_HEADER);
  requestHeaders.delete(SESSION_USER_EMAIL_HEADER);

  if (claims?.sub) {
    requestHeaders.set(SESSION_USER_ID_HEADER, claims.sub);
    if (typeof claims.email === "string" && claims.email) {
      requestHeaders.set(SESSION_USER_EMAIL_HEADER, claims.email);
    }
  }

  // 响应延迟到这里创建，才能同时带上刷新后的 Cookie、no-store 头与用户头
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  Object.entries(cookieHeaders).forEach(([key, value]) =>
    response.headers.set(key, value),
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
