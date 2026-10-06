import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "登录 | Casebook Timeline",
};

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  pkce_code_verifier_not_found:
    "重置验证状态已丢失（可能换了浏览器、清理了 Cookie，或重新发送过链接）。请重新发送重置链接，并在同一浏览器中立即点击。",
  AuthPKCECodeVerifierMissingError:
    "重置验证状态已丢失（可能换了浏览器、清理了 Cookie，或重新发送过链接）。请重新发送重置链接，并在同一浏览器中立即点击。",
  AuthPKCEGrantCodeExchangeError: "验证失败，请重新发送重置链接。",
  invalid_grant: "重置链接已过期、已使用或验证状态不匹配，请重新发送。",
  bad_code_verifier: "验证状态不匹配，请重新发送并点击最新一封邮件中的链接。",
  flow_state_not_found: "验证状态不存在，请重新发送重置链接。",
  flow_state_expired: "验证状态已过期，请重新发送重置链接。",
  missing_code: "链接不完整，请重新发送重置链接。",
  "missing-code": "链接不完整，请重新发送重置链接。",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const reason =
    typeof searchParams.reason === "string" ? searchParams.reason : undefined;
  const initialError =
    searchParams.error === "auth-callback-failed"
      ? (reason ? CALLBACK_ERROR_MESSAGES[reason] : undefined) ??
        "验证失败，请重新发送重置链接或重试。"
      : undefined;

  return (
    <main className="auth-wrap">
      <LoginForm initialError={initialError} />
    </main>
  );
}
