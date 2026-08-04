import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "注册 | Casebook Timeline",
};

export default function SignupPage() {
  return (
    <main className="auth-wrap">
      <SignupForm />
    </main>
  );
}