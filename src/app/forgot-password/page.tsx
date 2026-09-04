import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "忘记密码 | Casebook Timeline",
};

export default function ForgotPasswordPage() {
  return (
    <main className="auth-wrap">
      <ForgotPasswordForm />
    </main>
  );
}
