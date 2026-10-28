"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

type SidebarProps = {
  userEmail: string | null;
};

const MIN_WIDTH = 160;
const MAX_WIDTH = 440;
const DEFAULT_WIDTH = 240;

const NAV_ITEMS: {
  id: "timeline" | "search" | "shelf" | "signup";
  label: string;
  href: string;
  requiresGuest?: boolean;
}[] = [
  { id: "timeline", label: "时间线", href: "/#timeline" },
  { id: "search", label: "搜索", href: "/search" },
  { id: "shelf", label: "书架", href: "/shelf" },
  { id: "signup", label: "注册", href: "/signup", requiresGuest: true },
];

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  // 初始值直接读 localStorage（SSR 时回到默认值，且不参与渲染输出），
  // 避免先渲染 240px 再在 effect 里改成保存值造成的首屏跳动
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    try {
      const saved = Number(window.localStorage.getItem("sidebar-width"));
      return Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH
        ? saved
        : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${width}px`);
    try {
      localStorage.setItem("sidebar-width", String(width));
    } catch {
      // 隐私模式等禁用存储时忽略，宽度仍对当前页面生效
    }
  }, [width]);

  const handleResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const handleMove = (moveEvent: PointerEvent) => {
      const next = Math.min(
        Math.max(startWidth + (moveEvent.clientX - startX), MIN_WIDTH),
        MAX_WIDTH,
      );
      setWidth(next);
    };

    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.body.classList.remove("sidebar-resizing");
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.body.classList.add("sidebar-resizing");
  }, [width]);

  const isActive = (id: string) => {
    if (id === "timeline") return pathname === "/";
    if (id === "search") return pathname.startsWith("/search");
    if (id === "shelf") return pathname.startsWith("/shelf");
    if (id === "signup") return pathname.startsWith("/signup");
    return false;
  };

  const isLoggedIn = Boolean(userEmail);

  return (
    <aside className="sidebar">
      <div
        className="sidebar-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调节侧边栏宽度"
        onPointerDown={handleResizeStart}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
      />

      <div className="sidebar-brand">
        <p className="brand-kicker">推理小说档案</p>
        <Link className="wordmark" href="/" aria-label="Casebook Timeline 首页">
          <span>Casebook</span>
          <span>Timeline</span>
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
            aria-current={isActive(item.id) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-foot">
        {userEmail ? (
          <>
            <p className="sidebar-user">{userEmail}</p>
            <SignOutButton />
          </>
        ) : (
          <p className="sidebar-status">未登录</p>
        )}
      </div>
    </aside>
  );
}