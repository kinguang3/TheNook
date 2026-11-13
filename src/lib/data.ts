import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type {
  Author,
  Book,
  RatingStat,
  Review,
  Series,
  ShelfData,
} from "@/lib/types";
import { WIKI_URLS } from "@/lib/wiki-links";

const shelfRowStatuses = new Set(["unread", "reading", "finished"]);

// 目录数据（authors / series / books）是公开只读、极少变动的种子内容：
// 用不带 Cookie 的 anon 客户端读取，并交给 unstable_cache 跨请求缓存，
// 避免每次渲染都重复查 Supabase。用户个人数据仍走带会话的客户端按请求查。
// 目录有更新时调用 updateTag("catalog") 即可立即失效。
const CATALOG_CACHE = {
  revalidate: 600,
  tags: ["catalog"],
};

// rating_stats 由全体用户评分聚合而来，缓存窗口短一些；
// setRating 写入后会 updateTag("rating-stats") 主动失效。
const RATING_STATS_CACHE = {
  revalidate: 300,
  tags: ["rating-stats"],
};

// 书评是公开只读数据：用匿名客户端跨请求缓存；
// create / update / delete 后调 updateTag("reviews") 立即失效。
const REVIEWS_CACHE = {
  revalidate: 300,
  tags: ["reviews"],
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
    wikiUrl: WIKI_URLS[book.id] ?? "",
    rating: book.rating,
    tags: book.tags ?? [],
    blurb: book.blurb,
    note: book.note,
  }));
}

async function fetchCatalog(): Promise<{
  authors: Author[];
  seriesList: Series[];
  books: Book[];
}> {
  const supabase = publicClient();
  // 显式列出需要的列：既不扩展到未来新增字段，也避免把无用大字段带进缓存
  const [authorsResult, seriesResult, booksResult] = await Promise.all([
    supabase.from("authors").select("id, name, summary"),
    supabase.from("series").select("id, name, summary"),
    supabase
      .from("books")
      .select(
        "id, title, author_id, series_id, year, read_time, cover_tone, cover_mark, cover_url, rating, tags, blurb, note",
      )
      .order("year"),
  ]);

  // 任一查询失败即抛出，避免把空目录写进跨请求缓存；
  // 三张表一次取回，冷缓存时也不会被 getBooks/getAuthors 重复查询
  const failure = authorsResult.error ?? seriesResult.error ?? booksResult.error;
  if (failure) throw new Error(`加载目录失败：${failure.message}`);

  const authors = (authorsResult.data ?? []) as Author[];
  const seriesList = (seriesResult.data ?? []) as Series[];

  return {
    authors,
    seriesList,
    books: mapBookRows(
      (booksResult.data ?? []) as BookRow[],
      authors,
      seriesList,
    ),
  };
}

// generateMetadata 与页面会同时请求目录：React cache 按请求去重，
// 冷缓存时也不会对同一张表并发查两次；unstable_cache 继续负责跨请求缓存。
const getCatalog = cache(
  unstable_cache(fetchCatalog, ["catalog"], CATALOG_CACHE),
);

export async function getAuthors(): Promise<Author[]> {
  return (await getCatalog()).authors;
}

export async function getSeries(): Promise<Series[]> {
  return (await getCatalog()).seriesList;
}

export async function getBooks(): Promise<Book[]> {
  return (await getCatalog()).books;
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

export const getRatingStats = unstable_cache(
  fetchRatingStats,
  ["rating-stats"],
  RATING_STATS_CACHE,
);

async function fetchRatingStatForBook(
  bookId: string,
): Promise<RatingStat | null> {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("rating_stats")
    .select("book_id, avg_value, rating_count")
    .eq("book_id", bookId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    bookId: data.book_id as string,
    avgValue: Number(data.avg_value),
    ratingCount: Number(data.rating_count),
  };
}

// 书评页只需要当前这本书的聚合分：单行缓存比每次拉回全站聚合更省流量
export const getRatingStatForBook = unstable_cache(
  fetchRatingStatForBook,
  ["rating-stat"],
  RATING_STATS_CACHE,
);

export async function getFavorites(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("favorites")
    .select("book_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.book_id);
}

export async function getRatings(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("ratings")
    .select("book_id, value")
    .eq("user_id", userId);
  return Object.fromEntries(
    (data ?? []).map((row) => [row.book_id, row.value as number]),
  );
}

export async function getNotes(
  supabase: SupabaseClient,
  userId: string,
  bookIds?: string[],
): Promise<Record<string, string>> {
  // 专题页只需要当前书单的笔记；传入空列表时直接跳过查询
  if (bookIds && bookIds.length === 0) return {};

  const base = supabase
    .from("notes")
    .select("book_id, content")
    .eq("user_id", userId);
  const { data } = bookIds
    ? await base.in("book_id", bookIds)
    : await base;

  return Object.fromEntries(
    (data ?? []).map((row) => [row.book_id, row.content as string]),
  );
}

// 书评页只需要当前这本书的评分：单行查询比拉回全部评分再挑一本更省流量
export async function getRatingForBook(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("ratings")
    .select("value")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();
  return (data?.value as number | undefined) ?? null;
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

async function fetchReviews(bookId: string): Promise<Review[]> {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, book_id, user_id, content, created_at, updated_at, profiles(display_name)",
    )
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  // 同目录缓存：出错必须抛，避免把空书评缓存满整个窗口
  if (error) throw new Error(`加载书评失败：${error.message}`);

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

export const getReviewsByBook = unstable_cache(
  fetchReviews,
  ["reviews"],
  REVIEWS_CACHE,
);
