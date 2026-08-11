import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Author,
  Book,
  Series,
  ShelfData,
  UserData,
} from "@/lib/types";

const shelfRowStatuses = new Set(["unread", "reading", "finished"]);

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