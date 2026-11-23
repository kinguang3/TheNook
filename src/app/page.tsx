import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { getBooks, getFavorites, getRatingStats } from "@/lib/data";
import HomeClient from "@/components/home-client";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  // 会话、图书目录与评分聚合互不依赖，先一起发出请求；
  // 会话通常已在 layout 中缓存，拿到用户后立刻发收藏查询，与目录/评分并行
  const sessionPromise = getCurrentUser();
  const booksPromise = getBooks();
  const ratingStatsPromise = getRatingStats();

  const { supabase, user } = await sessionPromise;
  const favoritesPromise: Promise<string[]> = user
    ? getFavorites(supabase, user.id)
    : Promise.resolve([]);

  const [books, ratingStats, favorites] = await Promise.all([
    booksPromise,
    ratingStatsPromise,
    favoritesPromise,
  ]);

  return (
    <HomeClient
      initialBooks={books}
      favorites={favorites}
      ratingStats={ratingStats}
      isLoggedIn={Boolean(user)}
    />
  );
}
