import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type {
  Author,
  Book,
  RatingStat,
  Review,
  Series,
  ShelfData,
  UserData,
} from "@/lib/types";

const shelfRowStatuses = new Set(["unread", "reading", "finished"]);

// 目录数据（authors / series / books）是公开只读、极少变动的种子内容：
// 用不带 Cookie 的 anon 客户端读取，并交给 unstable_cache 跨请求缓存，
// 避免每次渲染都重复查 Supabase。用户个人数据仍走带会话的客户端按请求查。
// 目录有更新时调用 revalidateTag("catalog") 即可失效。
const CATALOG_CACHE = {
  revalidate: 600,
  tags: ["catalog"],
};

// rating_stats 由全体用户评分聚合而来，缓存窗口短一些；
// setRating 写入后会 revalidateTag("rating-stats") 主动失效。
const RATING_STATS_CACHE = {
  revalidate: 300,
  tags: ["rating-stats"],
};

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量。",
    );
  }
  return createClient(url, key);
}

async function fetchAuthors(): Promise<Author[]> {
  const supabase = publicClient();
  const { data } = await supabase.from("authors").select("*");
  return (data ?? []) as Author[];
}

async function fetchSeries(): Promise<Series[]> {
  const supabase = publicClient();
  const { data } = await supabase.from("series").select("*");
  return (data ?? []) as Series[];
}

type BookRow = {
  id: string;
  title: string;
  author_id: string;
  series_id: string | null;
  year: number;
  read_time: string;
  cover_tone: string;
  cover_mark: string;
  cover_url: string | null;
  rating: number;
  tags: string[];
  blurb: string;
  note: string;
};

function mapBookRows(
  rows: BookRow[],
  authors: Author[],
  seriesList: Series[],
): Book[] {
  const authorMap = new Map(authors.map((author) => [author.id, author]));
  const seriesMap = new Map(seriesList.map((entry) => [entry.id, entry]));

  return rows.map((book) => ({
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

async function fetchBooks(): Promise<Book[]> {
  const supabase = publicClient();
  const [authorsResult, seriesResult, booksResult] = await Promise.all([
    supabase.from("authors").select("*"),
    supabase.from("series").select("*"),
    supabase.from("books").select("*").order("year"),
  ]);

  return mapBookRows(
    (booksResult.data ?? []) as BookRow[],
    (authorsResult.data ?? []) as Author[],
    (seriesResult.data ?? []) as Series[],
  );
}

async function fetchRatingStats(): Promise<RatingStat[]> {
  const supabase = publicClient();
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

export const getAuthors = unstable_cache(fetchAuthors, ["catalog:authors"], CATALOG_CACHE);

export const getSeries = unstable_cache(fetchSeries, ["catalog:series"], CATALOG_CACHE);

export const getBooks = unstable_cache(fetchBooks, ["catalog:books"], CATALOG_CACHE);

export const getRatingStats = unstable_cache(
  fetchRatingStats,
  ["rating-stats"],
  RATING_STATS_CACHE,
);

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
