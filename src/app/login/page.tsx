import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "登录 | Casebook Timeline",
};

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <LoginForm />
    </main>
  );
}