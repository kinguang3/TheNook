import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthors, getBooks, getSeries } from "@/lib/data";
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
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();

  // 搜索需登录：未登录直接跳转登录页
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [authors, seriesList] = await Promise.all([
    getAuthors(supabase),
    getSeries(supabase),
  ]);
  const books = await getBooks(supabase, authors, seriesList);

  return (
    <main>
      <SearchClient
        books={books}
        authors={authors}
        initialQuery={q ?? ""}
      />
    </main>
  );
}
