import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getBooks,
  getRatingStats,
  getReviewsByBook,
  getUserData,
} from "@/lib/data";
import { ReviewsClient } from "@/components/reviews-client";

export const metadata: Metadata = {
  title: "书评 | Casebook Timeline",
};

export default async function BookReviewsPage(
  props: PageProps<"/books/[bookId]/reviews">,
) {
  const { bookId } = await props.params;

  // 书单与评分聚合走缓存
  const books = await getBooks();
  const book = books.find((entry) => entry.id === bookId);
  if (!book) {
    notFound();
  }

  const supabase = await createClient();
  // 书评与个人数据按请求实时查
  const [reviews, ratingStats] = await Promise.all([
    getReviewsByBook(supabase, bookId),
    getRatingStats(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userData = user ? await getUserData(supabase, user.id) : null;
  const stat = ratingStats.find((entry) => entry.bookId === bookId) ?? null;

  return (
    <main>
      <ReviewsClient
        book={book}
        initialReviews={reviews}
        currentUserId={user?.id ?? null}
        initialUserRating={userData?.ratings[bookId] ?? null}
        initialRatingStat={
          stat && stat.ratingCount > 0
            ? { avgValue: stat.avgValue, ratingCount: stat.ratingCount }
            : null
        }
      />
    </main>
  );
}
