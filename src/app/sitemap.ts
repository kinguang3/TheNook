import type { MetadataRoute } from "next";
import { getAuthors, getBooks, getSeries } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

// 目录来自 Supabase：请求时生成，避免本地/CI 构建阶段依赖外部网络。
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];

  try {
    const [books, authors, seriesList] = await Promise.all([
      getBooks(),
      getAuthors(),
      getSeries(),
    ]);

    return [
      ...home,
      ...books.map((book) => ({
        url: absoluteUrl(`/books/${book.id}/reviews`),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
      ...authors.map((author) => ({
        url: absoluteUrl(
          `/topic?type=author&id=${encodeURIComponent(author.id)}`,
        ),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
      ...seriesList.map((series) => ({
        url: absoluteUrl(
          `/topic?type=series&id=${encodeURIComponent(series.id)}`,
        ),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // 数据源暂不可用时不要整站 500，至少保留首页入口
    return home;
  }
}
