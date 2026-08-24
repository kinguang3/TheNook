"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Author, Book } from "@/lib/types";

type SearchClientProps = {
  books: Book[];
  authors: Author[];
  initialQuery: string;
  ratingAverages: Record<string, number>;
};

const DEBOUNCE_MS = 250;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function SearchClient({
  books,
  authors,
  initialQuery,
  ratingAverages,
}: SearchClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  // 记录最近一次由本组件写入 URL 的关键词，用于识别过期的 RSC 响应
  const replacedRef = useRef(initialQuery);

  // 刷新 / 直接访问 /search?q=xxx / 浏览器前进后退时保留关键词
  useEffect(() => {
    if (initialQuery !== replacedRef.current) {
      replacedRef.current = initialQuery;
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // 轻量 debounce 后 router.replace 同步 URL，不产生历史记录
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new URLSearchParams(window.location.search).get("q") ?? "";
      if (current === query) return;
      replacedRef.current = query;
      router.replace(
        query ? `/search?q=${encodeURIComponent(query)}` : "/search",
        { scroll: false },
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, router]);

  const keyword = normalize(query);
  const hasKeyword = keyword.length > 0;

  const results = useMemo(() => {
    if (!hasKeyword) return null;

    const matchText = (text: string) => text.toLowerCase().includes(keyword);
    // 书籍维度：不含 note（用户私人笔记）
    const matchBook = (book: Book) =>
      matchText(book.title) ||
      matchText(book.blurb) ||
      matchText(book.authorName) ||
      matchText(book.seriesName) ||
      book.tags.some(matchText);

    const matchedAuthors = authors.filter((author) => {
      if (matchText(author.name) || matchText(author.summary)) return true;
      // 作者相关书籍命中同样算作者命中；filter 天然保证同一作者只出现一次
      return books.some(
        (book) => book.authorId === author.id && matchBook(book),
      );
    });

    const matchedBooks = books.filter(matchBook);

    // 时间线维度：定位节点用 title / year / readTime / tags
    const timelineItems = books.filter(
      (book) =>
        matchText(book.title) ||
        String(book.year).includes(keyword) ||
        matchText(book.readTime) ||
        book.tags.some(matchText),
    );

    return { matchedAuthors, matchedBooks, timelineItems };
  }, [hasKeyword, keyword, authors, books]);

  const totalResults = results
    ? results.matchedAuthors.length +
      results.matchedBooks.length +
      results.timelineItems.length
    : 0;

  return (
    <>
      <section className="search-hero section-block">
        <p className="eyebrow">[+] Global Search</p>
        <h1>档案检索</h1>
        <input
          type="search"
          className="shelf-search search-input"
          placeholder="搜索作者、书名、标签、年份……"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="全局搜索"
          autoFocus
        />
        <p className="meta-text search-summary">
          {!hasKeyword
            ? "输入关键词，同时检索作者 / 书籍 / 时间线三个维度。"
            : `共 ${totalResults} 条结果 · 关键词「${query.trim()}」`}
        </p>
      </section>

      {results && (
        <>
          <section className="section-block" aria-labelledby="search-authors">
            <div className="section-head">
              <div>
                <p className="eyebrow">[+] Authors</p>
                <h2 id="search-authors">作者</h2>
              </div>
              <p className="meta-text">{results.matchedAuthors.length} 位</p>
            </div>
            {results.matchedAuthors.length === 0 ? (
              <p className="meta-text search-empty">没有匹配的作者。</p>
            ) : (
              <div className="search-list">
                {results.matchedAuthors.map((author) => {
                  const bookCount = books.filter(
                    (book) => book.authorId === author.id,
                  ).length;
                  return (
                    <Link
                      key={author.id}
                      className="search-row search-row-author"
                      href={`/topic?type=author&id=${author.id}`}
                    >
                      <div className="search-row-text">
                        <div className="search-row-head">
                          <h3 className="search-row-title">{author.name}</h3>
                          <span className="meta-text">{bookCount} 本收录</span>
                        </div>
                        <p className="search-row-desc">{author.summary}</p>
                      </div>
                      <span className="search-row-go meta-text" aria-hidden="true">
                        [→]
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="section-block" aria-labelledby="search-books">
            <div className="section-head">
              <div>
                <p className="eyebrow">[+] Books</p>
                <h2 id="search-books">书籍</h2>
              </div>
              <p className="meta-text">{results.matchedBooks.length} 本</p>
            </div>
            {results.matchedBooks.length === 0 ? (
              <p className="meta-text search-empty">没有匹配的书籍。</p>
            ) : (
              <div className="search-list">
                {results.matchedBooks.map((book) => (
                  <Link
                    key={book.id}
                    className="search-row has-cover"
                    href={`/books/${book.id}/reviews`}
                  >
                    <div className={`cover-block ${book.coverTone}`}>
                      {book.coverUrl ? (
                        <img
                          className="cover-image"
                          src={book.coverUrl}
                          alt={`${book.title} 封面`}
                          loading="lazy"
                        />
                      ) : (
                        <span className="cover-mark">{book.coverMark}</span>
                      )}
                    </div>
                    <div className="search-row-text">
                      <div className="search-row-head">
                        <h3 className="search-row-title">{book.title}</h3>
                        <span className="meta-text">
                          [{book.year}] {book.readTime} ·{" "}
                          {(ratingAverages[book.id] ?? book.rating).toFixed(1)}{" "}
                          / 5
                        </span>
                      </div>
                      <p className="meta-text">
                        {book.authorName} / {book.seriesName}
                      </p>
                      <p className="search-row-desc">{book.blurb}</p>
                      <div className="tag-pills">
                        {book.tags.map((tag) => (
                          <span className="tag-pill" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="search-row-go meta-text" aria-hidden="true">
                      [→]
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="section-block" aria-labelledby="search-timeline">
            <div className="section-head">
              <div>
                <p className="eyebrow">[+] Timeline Nodes</p>
                <h2 id="search-timeline">时间线</h2>
              </div>
              <p className="meta-text">{results.timelineItems.length} 个节点</p>
            </div>
            {results.timelineItems.length === 0 ? (
              <p className="meta-text search-empty">
                没有匹配的时间线节点。
              </p>
            ) : (
              <div className="search-list">
                {results.timelineItems.map((book) => (
                  <Link
                    key={book.id}
                    className="search-row search-row-timeline"
                    href={`/?focus=${encodeURIComponent(book.id)}#timeline`}
                  >
                    <div className="search-row-text">
                      <div className="search-row-head">
                        <h3 className="search-row-title">{book.title}</h3>
                        <span className="meta-text">
                          [{book.year}] {book.readTime}
                        </span>
                      </div>
                      <p className="meta-text">{book.authorName}</p>
                      <div className="tag-pills">
                        {book.tags.map((tag) => (
                          <span className="tag-pill" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="search-row-go meta-text" aria-hidden="true">
                      [↳ 时间线]
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {totalResults === 0 && (
            <section className="section-block">
              <p className="meta-text search-empty">
                没有找到与「{query.trim()}」相关的内容。换个关键词试试，比如作者名、书名或标签。
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
