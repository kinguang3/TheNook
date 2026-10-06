"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  NOOK_PKCE_COOKIE,
  generateRecoveryVerifier,
  recoveryChallenge,
} from "@/lib/pkce-recovery";

export type AuthState = {
  error?: string;
  message?: string;
};

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "邮箱或密码错误，请重新输入",
  "Email not confirmed": "邮箱尚未验证，请先查收验证邮件",
};

export async function login(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: AUTH_ERROR_MESSAGES[error.message] ?? error.message };
  }

  redirect("/");
}

export async function signup(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 6) {
    return { error: "请输入邮箱，密码至少 6 位。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return { message: "注册成功，请前往邮箱完成验证后再登录。" };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function resetPassword(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "请输入邮箱地址。" };
  }

  // 自持 PKCE：verifier 存在我们自己的 cookie 里，不依赖 auth-js 的
  // verifier cookie（会话清理/刷新失败时会被 removeAllPKCEVerifiers 误删）
  const verifier = generateRecoveryVerifier();
  const codeChallenge = await recoveryChallenge(verifier);
  // nk 让 verifier 随邮件链接走：换设备点击时没有自持 cookie，链接自带兜底
  const redirectTarget = `${siteUrl()}/auth/callback?nk=${verifier}`;
  const recoverUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTarget)}`;

  let status: number;
  let msg = "";
  try {
    const res = await fetch(recoverUrl, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        code_challenge: codeChallenge,
        code_challenge_method: "s256",
      }),
    });
    status = res.status;
    if (!res.ok) {
      try {
        msg = (await res.json())?.msg ?? "";
      } catch {
        // 忽略非 JSON 错误体
      }
    }
  } catch {
    return { error: "网络错误，请稍后再试" };
  }

  if (status >= 400) {
    if (status === 429 || /rate limit/i.test(msg)) {
      return { error: "操作太频繁，请稍后再试" };
    }
    if (status >= 500) {
      return { error: "邮件发送失败，请稍后再试" };
    }
    return { error: msg || "发送失败，请稍后再试" };
  }

  const cookieStore = await cookies();
  cookieStore.set(NOOK_PKCE_COOKIE, verifier, {
    path: "/",
    maxAge: 3600,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  return { message: "重置链接已发送到您的邮箱，请查收。" };
}

export async function updatePassword(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { error: "密码至少 6 位" };
  }
  if (password !== confirm) {
    return { error: "两次输入的密码不一致" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    if (error.message.toLowerCase().includes("session")) {
      return { error: "登录会话已过期，请回邮箱重新点击重置链接" };
    }
    return { error: error.message };
  }

  redirect("/");
}
