import { getCurrentUser } from "@/lib/supabase/server";
import { getBooks, getFavorites, getRatingStats } from "@/lib/data";
import HomeClient from "@/components/home-client";

export default async function HomePage() {
  const { supabase, user } = await getCurrentUser();

  // 图书目录与评分聚合走缓存；首页只渲染收藏状态，不必要地拉评分和笔记
  const [books, ratingStats, favorites] = await Promise.all([
    getBooks(),
    getRatingStats(),
    user ? getFavorites(supabase, user.id) : Promise.resolve<string[]>([]),
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
