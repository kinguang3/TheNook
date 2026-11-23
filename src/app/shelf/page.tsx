import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { getBooks, getFavorites, getShelfData } from "@/lib/data";
import type { ShelfData } from "@/lib/types";
import { ShelfClient } from "@/components/shelf-client";

export const metadata: Metadata = {
  title: "书架 | Casebook Timeline",
  robots: { index: false, follow: false },
};

export default async function ShelfPage() {
  const emptyShelf: ShelfData = {};
  // 书单走缓存，书架与收藏按用户实时查；书架页不渲染评分/笔记，不必拉那两张表。
  // 先把书单请求发出，拿到会话后立刻并行查书架/收藏，避免两者互相等待。
  const sessionPromise = getCurrentUser();
  const booksPromise = getBooks();

  const { supabase, user } = await sessionPromise;
  const [shelfData, favorites] = user
    ? await Promise.all([
        getShelfData(supabase, user.id),
        getFavorites(supabase, user.id),
      ])
    : [emptyShelf, [] as string[]];
  const books = await booksPromise;

  // 书架只展示已收藏的书：只序列化这部分，避免把整份目录发给客户端
  const favoriteSet = new Set(favorites);
  const shelfBooks = books.filter((book) => favoriteSet.has(book.id));

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
          books={shelfBooks}
          initialShelf={shelfData}
          initialFavorites={favorites}
          isAuthed={Boolean(user)}
        />
      </section>
    </main>
  );
}
