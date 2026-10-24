import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "登录 | Casebook Timeline",
};

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  pkce_code_verifier_not_found:
    "邮件链接未能在当前浏览器完成验证（可能换了设备、清理了 Cookie，或重复使用了旧链接）。请用邮箱和密码登录，系统会重新发送验证邮件。",
  AuthPKCECodeVerifierMissingError:
    "邮件链接未能在当前浏览器完成验证（可能换了设备、清理了 Cookie，或重复使用了旧链接）。请用邮箱和密码登录，系统会重新发送验证邮件。",
  AuthPKCEGrantCodeExchangeError:
    "验证失败，请用邮箱和密码登录以重新发送验证邮件。",
  invalid_grant:
    "邮件链接已过期、已使用或验证状态不匹配，请用邮箱和密码登录以重新发送验证邮件。",
  bad_code_verifier:
    "验证状态不匹配，请点击最新一封邮件中的链接，或重新注册获取新邮件。",
  flow_state_not_found:
    "邮件链接可能已被使用或重复打开，请用邮箱和密码登录以重新发送验证邮件。",
  flow_state_expired:
    "邮件链接已过期，请用邮箱和密码登录以重新发送验证邮件。",
  "verify:otp_expired":
    "邮件链接无效或已过期（只能使用一次，约 1 小时有效）。请点击最新一封邮件中的链接，或重新注册获取新邮件。",
  missing_code:
    "邮件链接无效、已过期或不完整，请点击最新一封邮件中的链接，或重新注册获取新邮件。",
  "missing-code":
    "邮件链接无效、已过期或不完整，请点击最新一封邮件中的链接，或重新注册获取新邮件。",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const reason =
    typeof searchParams.reason === "string" ? searchParams.reason : undefined;
  const mapped = reason
    ? CALLBACK_ERROR_MESSAGES[reason] ??
      (reason.startsWith("verify:")
        ? "邮件链接无效或已过期，请重新发送并点击最新一封邮件中的链接。"
        : undefined)
    : undefined;
  const initialError =
    searchParams.error === "auth-callback-failed"
      ? mapped ?? "验证失败，请用邮箱和密码登录以重新发送验证邮件，或重新注册。"
      : undefined;

  return (
    <main className="auth-wrap">
      <LoginForm initialError={initialError} />
    </main>
  );
}
