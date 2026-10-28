import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  getBooks,
  getRatingForBook,
  getRatingStats,
  getReviewsByBook,
} from "@/lib/data";
import { ReviewsClient } from "@/components/reviews-client";

export async function generateMetadata(
  props: PageProps<"/books/[bookId]/reviews">,
): Promise<Metadata> {
  const { bookId } = await props.params;
  const books = await getBooks();
  const book = books.find((entry) => entry.id === bookId);
  if (!book) {
    return { title: "书评 | Casebook Timeline" };
  }
  return {
    title: `${book.title} 的书评 | Casebook Timeline`,
    description: `${book.authorName} · ${book.year} · ${book.blurb.slice(0, 80)}`,
  };
}

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

  const { supabase, user } = await getCurrentUser();
  // 书评、评分聚合与「当前这本书」的个人评分并行查
  const [reviews, ratingStats, initialUserRating] = await Promise.all([
    getReviewsByBook(bookId),
    getRatingStats(),
    user ? getRatingForBook(supabase, user.id, bookId) : Promise.resolve(null),
  ]);
  const stat = ratingStats.find((entry) => entry.bookId === bookId) ?? null;

  return (
    <main>
      <ReviewsClient
        book={book}
        initialReviews={reviews}
        currentUserId={user?.id ?? null}
        initialUserRating={initialUserRating}
        initialRatingStat={
          stat && stat.ratingCount > 0
            ? { avgValue: stat.avgValue, ratingCount: stat.ratingCount }
            : null
        }
      />
    </main>
  );
}
