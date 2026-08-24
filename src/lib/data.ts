import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Author,
  Book,
  RatingStat,
  Review,
  Series,
  ShelfData,
  TimelineReview,
  UserData,
} from "@/lib/types";

const shelfRowStatuses = new Set(["unread", "reading", "finished"]);
const excerptLength = 80;

export async function getAuthors(
  supabase: SupabaseClient,
): Promise<Author[]> {
  const { data } = await supabase.from("authors").select("*");
  return (data ?? []) as Author[];
}

export async function getSeries(
  supabase: SupabaseClient,
): Promise<Series[]> {
  const { data } = await supabase.from("series").select("*");
  return (data ?? []) as Series[];
}

export async function getBooks(
  supabase: SupabaseClient,
  authors: Author[],
  seriesList: Series[],
): Promise<Book[]> {
  const { data } = await supabase.from("books").select("*").order("year");
  const books = (data ?? []) as Array<{
    id: string;
    title: string;
    author_id: string;
    series_id: string | null;
    year: number;
    read_time: string;
    cover_tone: string;
    cover_mark: string;
    cover_url: string;
    rating: number;
    tags: string[];
    blurb: string;
    note: string;
  }>;

  const authorMap = new Map(authors.map((author) => [author.id, author]));
  const seriesMap = new Map(seriesList.map((entry) => [entry.id, entry]));

  return books.map((book) => ({
    id: book.id,
    title: book.title,
    authorId: book.author_id,
    authorName: authorMap.get(book.author_id)?.name ?? "",
    seriesId: book.series_id,
    seriesName: book.series_id
      ? seriesMap.get(book.series_id)?.name ?? "单行本"
      : "单行本",
    year: book.year,
    readTime: book.read_time,
    coverTone: book.cover_tone,
    coverMark: book.cover_mark,
    coverUrl: book.cover_url ?? "",
    rating: book.rating,
    tags: book.tags ?? [],
    blurb: book.blurb,
    note: book.note,
  }));
}

export async function getRatingStats(
  supabase: SupabaseClient,
): Promise<RatingStat[]> {
  // rating_stats 是聚合视图（视图未在 Supabase 创建时查询失败，返回空数组回退档案评分）
  const { data, error } = await supabase
    .from("rating_stats")
    .select("book_id, avg_value, rating_count");
  if (error) return [];
  return (data ?? []).map((row) => ({
    bookId: row.book_id as string,
    avgValue: Number(row.avg_value),
    ratingCount: Number(row.rating_count),
  }));
}

export async function getUserData(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserData> {
  const [favorites, ratings, notes] = await Promise.all([
    supabase.from("favorites").select("book_id").eq("user_id", userId),
    supabase.from("ratings").select("book_id, value").eq("user_id", userId),
    supabase.from("notes").select("book_id, content").eq("user_id", userId),
  ]);

  return {
    favorites: (favorites.data ?? []).map((row) => row.book_id),
    ratings: Object.fromEntries(
      (ratings.data ?? []).map((row) => [row.book_id, row.value as number]),
    ),
    notes: Object.fromEntries(
      (notes.data ?? []).map((row) => [row.book_id, row.content as string]),
    ),
  };
}

export function getAllTags(books: Book[]): string[] {
  return [...new Set(books.flatMap((book) => book.tags))];
}

export async function getShelfData(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShelfData> {
  const { data } = await supabase
    .from("shelf")
    .select("book_id, progress, status, last_read_at")
    .eq("user_id", userId);

  const shelf: ShelfData = {};
  for (const row of data ?? []) {
    const status = row.status as "unread" | "reading" | "finished";
    if (!shelfRowStatuses.has(status)) continue;
    shelf[row.book_id as string] = {
      progress: row.progress as number,
      status,
      lastReadAt: row.last_read_at as string | null,
    };
  }
  return shelf;
}

type ReviewRow = {
  id: string;
  book_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  profiles: { display_name: string } | null;
};

function toAuthorName(row: ReviewRow): string {
  return row.profiles?.display_name ?? "匿名侦探";
}

export async function getReviewsByBook(
  supabase: SupabaseClient,
  bookId: string,
): Promise<Review[]> {
  const { data } = await supabase
    .from("reviews")
    .select(
      "id, book_id, user_id, content, created_at, updated_at, profiles(display_name)",
    )
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as ReviewRow[]).map((row) => ({
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    authorName: toAuthorName(row),
  }));
}

export async function getRecentReviews(
  supabase: SupabaseClient,
): Promise<TimelineReview[]> {
  const { data } = await supabase
    .from("reviews")
    .select("id, book_id, content, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as unknown as ReviewRow[]).map((row) => ({
    id: row.id,
    bookId: row.book_id,
    excerpt:
      row.content.length > excerptLength
        ? `${row.content.slice(0, excerptLength)}……`
        : row.content,
    createdAt: row.created_at,
    authorName: toAuthorName(row),
  }));
}