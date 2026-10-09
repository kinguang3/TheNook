import { createClient } from "@/lib/supabase/server";
import { getBooks, getRatingStats, getUserData } from "@/lib/data";
import { emptyUserData } from "@/lib/types";
import HomeClient from "@/components/home-client";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 图书目录与评分聚合走缓存；用户个人数据按请求查询
  const [books, ratingStats, userData] = await Promise.all([
    getBooks(),
    getRatingStats(),
    user ? getUserData(supabase, user.id) : Promise.resolve(emptyUserData),
  ]);

  return (
    <HomeClient
      initialBooks={books}
      userData={userData}
      ratingStats={ratingStats}
      isLoggedIn={Boolean(user)}
    />
  );
}
