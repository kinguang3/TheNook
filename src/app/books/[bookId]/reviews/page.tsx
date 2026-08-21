import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthors,
  getBooks,
  getReviewsByBook,
  getSeries,
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

  const [reviews, userData] = await Promise.all([
    getReviewsByBook(supabase, bookId),
    supabase.auth.getUser(),
  ]);

  return (
    <main>
      <ReviewsClient
        book={book}
        initialReviews={reviews}
        currentUserId={userData.data.user?.id ?? null}
      />
    </main>
  );
}
