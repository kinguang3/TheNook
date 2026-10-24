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
  "User already registered": "该邮箱已注册，请直接登录",
  "Email rate limit exceeded": "操作太频繁，请稍后再试",
  "Password should be at least 6 characters": "密码至少 6 位",
  "Signups not allowed for this instance": "本站暂未开放注册",
};

// Supabase 的部分文案带动态后缀（如 "…only request this after 47 seconds"），
// 精确匹配不到时再用前缀/正则兜底
function translateAuthError(message: string): string {
  const exact = AUTH_ERROR_MESSAGES[message];
  if (exact) return exact;
  if (/rate limit|only request this after/i.test(message)) {
    return "操作太频繁，请稍后再试";
  }
  return message;
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

function isAlreadyRegistered(message: string, code?: string): boolean {
  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered|already exists/i.test(message)
  );
}

// 同邮箱重复注册时 GoTrue 不会重发确认邮件（开启邮箱确认时还会返回
// identities 为空的混淆用户），这里显式补发；已确认的账号会被拒绝，
// 引导其直接登录。
async function resendSignupEmail(
  supabase: ServerClient,
  email: string,
  emailRedirectTo: string,
): Promise<AuthState> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });

  if (!error) {
    // GoTrue 对不存在/已确认的邮箱同样返回 200 且不发信（防枚举），
    // 所以文案不能一口咬定“已发送”
    return {
      message:
        "如果该邮箱尚未完成验证，新的验证邮件已发送，请查收后再登录；若已完成验证，请直接登录。",
    };
  }
  if (
    isAlreadyRegistered(error.message) ||
    /already confirmed/i.test(error.message)
  ) {
    return { error: "该邮箱已注册并完成验证，请直接登录；忘记密码可点「忘记密码」。" };
  }
  if (
    error.code === "over_email_send_rate_limit" ||
    /rate limit|only request this after/i.test(error.message)
  ) {
    // 上一封大概率已经发出，不要吓用户说“失败”
    return { message: "验证邮件刚刚发送过，请稍后查收（含垃圾邮件箱）。" };
  }
  return { error: translateAuthError(error.message) };
}

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
    // 凭据正确但邮箱未验证：顺手补发确认邮件，并用中性提示替代红字
    if (
      error.code === "email_not_confirmed" ||
      /email not confirmed/i.test(error.message)
    ) {
      const resent = await resendSignupEmail(
        supabase,
        email,
        `${siteUrl()}/auth/callback`,
      );
      return resent.error
        ? { message: "邮箱尚未验证，请先查收验证邮件；如未收到，请稍后重试。" }
        : resent;
    }
    return { error: translateAuthError(error.message) };
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
  const emailRedirectTo = `${siteUrl()}/auth/callback`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    if (isAlreadyRegistered(error.message, error.code)) {
      return resendSignupEmail(supabase, email, emailRedirectTo);
    }
    return { error: translateAuthError(error.message) };
  }

  // identities 为空 = 邮箱已存在（GoTrue 的防枚举混淆用户），signUp 不会发信
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return resendSignupEmail(supabase, email, emailRedirectTo);
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
