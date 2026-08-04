"use client";

import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="button-link">
        [x] 退出
      </button>
    </form>
  );
}