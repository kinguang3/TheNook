"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, signup, type AuthState } from "@/app/actions/auth";

const emptyState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, emptyState);

  return (
    <form action={formAction} className="auth-card">
      <p className="eyebrow">[+] Sign In</p>
      <h1>登录</h1>

      <div className="auth-field">
        <label htmlFor="login-email">邮箱</label>
        <input
          id="login-email"
          name="email"
          type="email"
          className="auth-input"
          autoComplete="email"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="login-password">密码</label>
        <input
          id="login-password"
          name="password"
          type="password"
          className="auth-input"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.message ? <p className="auth-message">{state.message}</p> : null}

      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? "登录中..." : "登录"}
      </button>

      <p className="auth-switch">
        还没有账号？<Link href="/signup">去注册</Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, emptyState);

  return (
    <form action={formAction} className="auth-card">
      <p className="eyebrow">[+] Sign Up</p>
      <h1>注册</h1>

      <div className="auth-field">
        <label htmlFor="signup-email">邮箱</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          className="auth-input"
          autoComplete="email"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="signup-password">密码</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          className="auth-input"
          autoComplete="new-password"
          minLength={6}
          required
        />
        <p className="meta-text">至少 6 位，建议包含字母与数字。</p>
      </div>

      {state?.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.message ? <p className="auth-message">{state.message}</p> : null}

      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? "注册中..." : "注册"}
      </button>

      <p className="auth-switch">
        已有账号？<Link href="/login">直接登录</Link>
      </p>
    </form>
  );
}