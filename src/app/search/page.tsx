import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAuthors, getBooks, getRatingStats } from "@/lib/data";
import { SearchClient } from "@/components/search-client";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: `搜索${q ? ` / ${q}` : ""} | Casebook Timeline`,
    description: "按作者、书籍与时间线三个维度检索推理小说档案。",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  // 搜索需登录：未登录直接跳转登录页
  // 会话校验与缓存目录/评分并行，避免串行等待
  const [{ user }, books, authors, ratingStats] = await Promise.all([
    getCurrentUser(),
    getBooks(),
    getAuthors(),
    getRatingStats(),
  ]);
  if (!user) {
    redirect("/login");
  }
  const ratingAverages = Object.fromEntries(
    ratingStats.map((stat) => [stat.bookId, stat.avgValue]),
  );

  return (
    <main>
      <SearchClient
        books={books}
        authors={authors}
        initialQuery={q ?? ""}
        ratingAverages={ratingAverages}
      />
    </main>
  );
}
