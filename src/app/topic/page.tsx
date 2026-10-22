import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAuthors, getBooks, getSeries, getUserData } from "@/lib/data";
import { emptyUserData, type Author, type Series } from "@/lib/types";

type TopicPageProps = {
  searchParams: Promise<{ type?: string; id?: string }>;
};

export async function generateMetadata({
  searchParams,
}: TopicPageProps): Promise<Metadata> {
  const { type, id } = await searchParams;
  if ((type !== "author" && type !== "series") || !id) {
    return { title: "专题 | Casebook Timeline" };
  }
  const label = type === "series" ? "系列" : "作者";
  const [authors, seriesList] = await Promise.all([getAuthors(), getSeries()]);
  const name =
    type === "series"
      ? seriesList.find((entry) => entry.id === id)?.name
      : authors.find((entry) => entry.id === id)?.name;
  return {
    title: name
      ? `${name} / ${label}专题 | Casebook Timeline`
      : `专题 / ${label} | Casebook Timeline`,
    description: name
      ? `查看推理小说${label}「${name}」的聚合书单与简介。`
      : `查看推理小说${label}专题，浏览聚合书单与相关简介。`,
  };
}

export default async function TopicPage({ searchParams }: TopicPageProps) {
  const { type, id } = await searchParams;

  // 参数不合法直接 404，避免无谓的数据查询
  if ((type !== "author" && type !== "series") || !id) {
    notFound();
  }

  // 目录数据走缓存；当前用户与个人笔记一起并行取，去掉串行等待
  const { supabase, user } = await getCurrentUser();
  const [authors, seriesList, books, userData] = await Promise.all([
    getAuthors(),
    getSeries(),
    getBooks(),
    user ? getUserData(supabase, user.id) : Promise.resolve(emptyUserData),
  ]);

  const topic: Author | Series | null =
    type === "author"
      ? (authors.find((author) => author.id === id) ?? null)
      : (seriesList.find((entry) => entry.id === id) ?? null);

  if (!topic) {
    notFound();
  }

  const topicBooks = books
    .filter((book) =>
      type === "author" ? book.authorId === id : book.seriesId === id,
    )
    .sort((a, b) => a.year - b.year);

  const label = type === "author" ? "作者" : "系列";

  const relatedSeries = type === "author"
    ? [...new Set(topicBooks.map((book) => book.seriesId).filter(Boolean))]
    : [];
  const relatedAuthors =
    type === "series"
      ? [...new Set(topicBooks.map((book) => book.authorId))]
      : [];

  return (
    <main>
      <section className="topic-hero section-block" id="topic-hero">
        <h1>
          {topic.name} / {label}专题
        </h1>
        <p className="hero-text">{topic.summary}</p>
        <div className="topic-links">
          {type === "author" &&
            relatedSeries.map((seriesId) => {
              const entry = seriesList.find((item) => item.id === seriesId);
              if (!entry) return null;
              return (
                <Link
                  key={seriesId}
                  className="topic-link"
                  href={`/topic?type=series&id=${seriesId}`}
                >
                  系列：{entry.name}
                </Link>
              );
            })}
          {type === "series" &&
            relatedAuthors.map((authorId) => {
              const entry = authors.find((item) => item.id === authorId);
              if (!entry) return null;
              return (
                <Link
                  key={authorId}
                  className="topic-link"
                  href={`/topic?type=author&id=${authorId}`}
                >
                  作者：{entry.name}
                </Link>
              );
            })}
        </div>
      </section>

      <section
        className="section-block"
        id="topic-list"
        aria-labelledby="topic-list-title"
      >
        <div className="section-head">
          <div>
            <h2 id="topic-list-title">相关书目</h2>
          </div>
          <p className="meta-text">{topicBooks.length} 条相关书目</p>
        </div>

        <div className="topic-grid">
          {topicBooks.map((book) => (
            <article className="topic-card" key={book.id}>
              <p className="card-case">
                {book.year}　{book.readTime}
              </p>
              <div className={`cover-block ${book.coverTone}`}>
                {book.coverUrl ? (
                  <Image
                    className="cover-image"
                    src={book.coverUrl}
                    alt={`${book.title} 封面`}
                    fill
                    sizes="(max-width: 640px) 90vw, 300px"
                  />
                ) : (
                  <span className="cover-mark">{book.coverMark}</span>
                )}
              </div>
              <h3>{book.title}</h3>
              <p>
                {book.authorName}，{book.seriesName}
              </p>
              <p className="card-tags">{book.tags.join("，")}</p>
              <p>{userData.notes[book.id] || book.note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
