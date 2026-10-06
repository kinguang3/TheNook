"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RecoveryWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // 兜底 1: 邮件链接 redirect 被 Supabase fallback 到首页等页面时，
    // URL 上会残留 ?code=，在客户端完成 exchange 并按类型跳转
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );

    // GoTrue 对无效/过期链接可能以 ?error_code=... 或 #error_code=... 形式落在任意页
    const goTrueErrorCode =
      params.get("error_code") ?? hashParams.get("error_code");
    if (goTrueErrorCode && !params.get("code")) {
      window.location.replace(
        `/login?error=auth-callback-failed&reason=${encodeURIComponent(
          `verify:${goTrueErrorCode}`,
        )}`,
      );
      return;
    }

    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          const reason =
            (error as { code?: string }).code ?? error.name ?? "exchange-failed";
          window.location.replace(
            `/login?error=auth-callback-failed&reason=${encodeURIComponent(reason)}`,
          );
          return;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("flow");
        window.history.replaceState(null, "", url.toString());
        const redirectType = (data as { redirectType?: string } | null)
          ?.redirectType;
        router.replace(
          redirectType === "recovery" ? "/auth/reset-password" : "/",
        );
      });
    }

    // 兜底 2: implicit hash 流程 (#access_token=...&type=recovery) 落到任意页
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/auth/reset-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
