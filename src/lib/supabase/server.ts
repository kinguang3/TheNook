import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import {
  SESSION_USER_EMAIL_HEADER,
  SESSION_USER_ID_HEADER,
  type SessionUser,
} from "@/lib/auth-session";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; ignore middleware-safe writes.
          }
        },
      },
    },
  );
}

// layout 与页面渲染在同一请求里都会用到当前用户：用 React cache 按请求去重。
// proxy 已用 getClaims 验签并把用户写进请求头，这里直接复用，省掉每页再向
// Supabase Auth 发一次 getUser 的往返；只有头缺失（如 proxy 未覆盖的路径）
// 才回退到 getUser。
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const headerStore = await headers();
  const id = headerStore.get(SESSION_USER_ID_HEADER);

  if (id) {
    const user: SessionUser = {
      id,
      email: headerStore.get(SESSION_USER_EMAIL_HEADER),
    };
    return { supabase, user };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user: user
      ? ({ id: user.id, email: user.email ?? null } satisfies SessionUser)
      : null,
  };
});
