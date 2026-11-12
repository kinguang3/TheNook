import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { getBooks, getFavorites, getRatingStats } from "@/lib/data";
import HomeClient from "@/components/home-client";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  // 会话、图书目录与评分聚合互不依赖，一起发出请求；
  // 首页只渲染收藏状态，不必要地拉评分和笔记
  const [{ supabase, user }, books, ratingStats] = await Promise.all([
    getCurrentUser(),
    getBooks(),
    getRatingStats(),
  ]);
  const favorites = user ? await getFavorites(supabase, user.id) : [];

  return (
    <HomeClient
      initialBooks={books}
      favorites={favorites}
      ratingStats={ratingStats}
      isLoggedIn={Boolean(user)}
    />
  );
}
