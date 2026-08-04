import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthors,
  getBooks,
  getSeries,
  getUserData,
} from "@/lib/data";
import { emptyUserData, type Author, type Series } from "@/lib/types";

type TopicPageProps = {
  searchParams: Promise<{ type?: string; id?: string }>;
};

export async function generateMetadata({
  searchParams,
}: TopicPageProps): Promise<Metadata> {
  const { type, id } = await searchParams;
  const label = type === "series" ? "系列" : "作者";
  return {
    title: `专题 / ${label} | Casebook Timeline`,
    description: `查看推理小说${label}专题，浏览聚合书单与相关简介。`,
  };
}

export default async function TopicPage({ searchParams }: TopicPageProps) {
  const { type, id } = await searchParams;

  const supabase = await createClient();
  const [authors, seriesList] = await Promise.all([
    getAuthors(supabase),
    getSeries(supabase),
  ]);
  const books = await getBooks(supabase, authors, seriesList);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userData = user ? await getUserData(supabase, user.id) : emptyUserData;

  if (type !== "author" && type !== "series") {
    notFound();
  }

  const topic: Author | Series | null =
    type === "author"
      ? (authors.find((author) => author.id === id) ?? null)
      : (seriesList.find((entry) => entry.id === id) ?? null);

  if (!topic || !id) {
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
        <p className="eyebrow">[+] Topic Dossier</p>
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
            <p className="eyebrow">[+] Reading File</p>
            <h2 id="topic-list-title">相关书目</h2>
          </div>
          <p className="meta-text">{topicBooks.length} 条相关书目</p>
        </div>

        <div className="topic-grid">
          {topicBooks.map((book) => (
            <article className="topic-card" key={book.id}>
              <p className="eyebrow">
                [{book.year}] {book.readTime}
              </p>
              <div className={`cover-block ${book.coverTone}`}>
                <span className="cover-mark">{book.coverMark}</span>
              </div>
              <h3>{book.title}</h3>
              <p>
                {book.authorName} / {book.seriesName}
              </p>
              <div className="tag-pills">
                {book.tags.map((tag) => (
                  <span className="tag-pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <p>{userData.notes[book.id] || book.note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}