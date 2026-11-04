import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  getBooks,
  getRatingForBook,
  getRatingStats,
  getReviewsByBook,
} from "@/lib/data";
import { absoluteUrl } from "@/lib/site";
import { ReviewsClient } from "@/components/reviews-client";

export async function generateMetadata(
  props: PageProps<"/books/[bookId]/reviews">,
): Promise<Metadata> {
  const { bookId } = await props.params;
  const books = await getBooks();
  const book = books.find((entry) => entry.id === bookId);
  if (!book) {
    return {
      title: "书评 | Casebook Timeline",
      robots: { index: false, follow: false },
    };
  }
  const title = `${book.title} 的书评 | Casebook Timeline`;
  const description = `${book.authorName} · ${book.year} · ${book.blurb.slice(0, 80)}`;
  const path = `/books/${bookId}/reviews`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "article", title, description, url: path },
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

  // 结构化数据：公开书目 + 聚合评分 + 页面上可见的书评。
  // 只使用真实存在的数据，没有评分/书评时不编造字段。
  const reviewSchema = reviews.map((review) => ({
    "@type": "Review",
    reviewBody: review.content,
    datePublished: review.createdAt,
    author: { "@type": "Person", name: review.authorName },
  }));
  const bookSchema: Record<string, unknown> = {
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.authorName },
    inLanguage: "zh-CN",
    url: absoluteUrl(`/books/${bookId}/reviews`),
  };
  if (stat && stat.ratingCount > 0) {
    bookSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: stat.avgValue,
      ratingCount: stat.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (reviewSchema.length > 0) {
    bookSchema.review = reviewSchema;
  }
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      bookSchema,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("/") },
          {
            "@type": "ListItem",
            position: 2,
            name: `${book.title} 的书评`,
            item: absoluteUrl(`/books/${bookId}/reviews`),
          },
        ],
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
