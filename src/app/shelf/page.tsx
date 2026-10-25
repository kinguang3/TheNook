import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { getBooks, getFavorites, getShelfData } from "@/lib/data";
import type { ShelfData } from "@/lib/types";
import { ShelfClient } from "@/components/shelf-client";

export default async function ShelfPage() {
  const { supabase, user } = await getCurrentUser();

  const emptyShelf: ShelfData = {};
  // 书单走缓存，书架与收藏按用户实时查；书架页不渲染评分/笔记，不必拉那两张表
  const [books, shelfData, favorites] = await Promise.all([
    getBooks(),
    user ? getShelfData(supabase, user.id) : Promise.resolve(emptyShelf),
    user ? getFavorites(supabase, user.id) : Promise.resolve<string[]>([]),
  ]);

  return (
    <main>
      <section className="section-block">
        <div className="section-head">
          <div>
            <h1>用户书架</h1>
          </div>
          <p className="meta-text">
            {user
              ? `${favorites.length} 本已收藏，按阅读进度排序`
              : "登录后收藏书籍并记录阅读进度"}
          </p>
        </div>

        {!user && (
          <p className="shelf-notice">
            尚未登录，收藏与进度无法同步。
            <Link className="info-link" href="/login">
              去登录
            </Link>
          </p>
        )}

        <ShelfClient
          books={books}
          initialShelf={shelfData}
          initialFavorites={favorites}
          isAuthed={Boolean(user)}
        />
      </section>
    </main>
  );
}
