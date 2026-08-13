"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

type SidebarProps = {
  userEmail: string | null;
};

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;

const NAV_ITEMS: {
  id: "timeline" | "shelf" | "signup" | "login";
  label: string;
  href: string;
  requiresGuest?: boolean;
}[] = [
  { id: "timeline", label: "时间线", href: "/#timeline" },
  { id: "shelf", label: "书架", href: "/shelf" },
  { id: "signup", label: "注册", href: "/signup", requiresGuest: true },
  { id: "login", label: "登入", href: "/login", requiresGuest: true },
];

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const saved = Number(localStorage.getItem("sidebar-width"));
    if (Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) {
      setWidth(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${width}px`);
    localStorage.setItem("sidebar-width", String(width));
  }, [width]);

  const isActive = (id: string) => {
    if (id === "timeline") return pathname === "/";
    if (id === "shelf") return pathname.startsWith("/shelf");
    if (id === "login") return pathname.startsWith("/login");
    if (id === "signup") return pathname.startsWith("/signup");
    return false;
  };

  const isLoggedIn = Boolean(userEmail);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <p className="eyebrow">[casebook/timeline]</p>
        <Link className="wordmark" href="/" aria-label="Casebook Timeline 首页">
          <span>CASEBOOK</span>
          <span>TIMELINE</span>
        </Link>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        {NAV_ITEMS.filter(
          (item) => !item.requiresGuest || !isLoggedIn,
        ).map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`sidebar-link${isActive(item.id) ? " active" : ""}`}
          >
            <span aria-hidden="true">{isActive(item.id) ? "[x]" : "[+]"}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-foot">
        {userEmail ? (
          <>
            <p className="user-chip">[{userEmail}]</p>
            <SignOutButton />
          </>
        ) : (
          <p className="sidebar-status">[ ] 未登录</p>
        )}
        <p className="sidebar-meta">[/static/v0.1]</p>
        <label className="sidebar-width-control">
          <span>栏宽 {width}px</span>
          <input
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={10}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            aria-label="调节侧边栏宽度"
          />
        </label>
      </div>
    </aside>
  );
}