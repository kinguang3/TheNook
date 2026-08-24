import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthors,
  getBooks,
  getRatingStats,
  getReviewsByBook,
  getSeries,
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
  const supabase = await createClient();

  const [authors, seriesList] = await Promise.all([
    getAuthors(supabase),
    getSeries(supabase),
  ]);
  const books = await getBooks(supabase, authors, seriesList);
  const book = books.find((entry) => entry.id === bookId);
  if (!book) {
    notFound();
  }

  const [reviews, ratingStats] = await Promise.all([
    getReviewsByBook(supabase, bookId),
    getRatingStats(supabase),
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
