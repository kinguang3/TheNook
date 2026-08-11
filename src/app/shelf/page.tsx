import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthors,
  getBooks,
  getSeries,
  getShelfData,
} from "@/lib/data";
import { ShelfClient } from "@/components/shelf-client";

export default async function ShelfPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [authors, seriesList] = await Promise.all([
    getAuthors(supabase),
    getSeries(supabase),
  ]);
  const books = await getBooks(supabase, authors, seriesList);
  const shelfData = user ? await getShelfData(supabase, user.id) : {};

  return (
    <main>
      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="eyebrow">[user/bookshelf]</p>
            <h1>用户书架</h1>
          </div>
          <p className="meta-text">
            {user ? `${books.length} 本 · 按阅读进度排序` : "登录后记录阅读进度"}
          </p>
        </div>

        {!user && (
          <p className="shelf-notice">
            [ ] 尚未登录，进度与状态仅本地展示。
            <Link className="info-link" href="/login">
              去登录
            </Link>
          </p>
        )}

        <ShelfClient
          books={books}
          initialShelf={shelfData}
          isAuthed={Boolean(user)}
        />
      </section>
    </main>
  );
}