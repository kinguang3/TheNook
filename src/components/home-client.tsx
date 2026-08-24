"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  setRating,
  toggleFavorite,
} from "@/app/actions/user-data";
import type { Book, TimelineReview, UserData } from "@/lib/types";
import { Typewriter } from "@/components/typewriter";

type HomeClientProps = {
  books: Book[];
  allTags: string[];
  initialUserData: UserData;
  isAuthed: boolean;
  recentReviews: TimelineReview[];
  focusBookId?: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function HomeClient({
  books,
  allTags,
  initialUserData,
  isAuthed,
  recentReviews,
  focusBookId,
}: HomeClientProps) {
  const [activeTag, setActiveTag] = useState("全部");
  const [userData, setUserData] = useState(initialUserData);
  const [busyFavorites, setBusyFavorites] = useState<Set<string>>(new Set());
  const [busyRatings, setBusyRatings] = useState<Set<string>>(new Set());

  const timelineRootRef = useRef<HTMLDivElement>(null);
  const timelineProgressRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const applyResult = useCallback((result: unknown) => {
    if (!result || typeof result !== "object") return;
    const entry = result as { data?: UserData; error?: string };
    if (entry.data) {
      setUserData(entry.data);
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (bookId: string) => {
      if (!isAuthed || busyFavorites.has(bookId)) return;
      setBusyFavorites((prev) => new Set(prev).add(bookId));
      try {
        const result = await toggleFavorite(bookId);
        applyResult(result);
      } finally {
        setBusyFavorites((prev) => {
          const next = new Set(prev);
          next.delete(bookId);
          return next;
        });
      }
    },
    [isAuthed, busyFavorites, applyResult],
  );

  const handleSetRating = useCallback(
    async (bookId: string, value: number) => {
      if (!isAuthed || busyRatings.has(bookId)) return;
      setBusyRatings((prev) => new Set(prev).add(bookId));
      try {
        const result = await setRating(bookId, value);
        applyResult(result);
      } finally {
        setBusyRatings((prev) => {
          const next = new Set(prev);
          next.delete(bookId);
          return next;
        });
      }
    },
    [isAuthed, busyRatings, applyResult],
  );

  // 从搜索页跳转：重置标签筛选，滚动到目标节点并短暂高亮
  useEffect(() => {
    if (!focusBookId) return;
    setActiveTag("全部");

    let highlightTimer = 0;
    // 等待筛选重置后的 DOM 提交完成再定位
    const locateTimer = window.setTimeout(() => {
      const target = document.querySelector(
        `[data-book-id="${CSS.escape(focusBookId)}"]`,
      );
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("timeline-focus");
      highlightTimer = window.setTimeout(
        () => target.classList.remove("timeline-focus"),
        2600,
      );
    }, 100);

    return () => {
      window.clearTimeout(locateTimer);
      if (highlightTimer) window.clearTimeout(highlightTimer);
    };
  }, [focusBookId]);

  // 时间线滚动进度
  useEffect(() => {
    const progressEl = timelineProgressRef.current;
    const timelineEl = timelineRootRef.current;
    if (!progressEl || !timelineEl) return;

    let ticking = false;

    const update = () => {
      ticking = false;
      const rect = timelineEl.getBoundingClientRect();
      const total = rect.height + window.innerHeight;
      const visible = clamp(window.innerHeight - rect.top, 0, total);
      progressEl.style.height = `${(visible / total) * 100}%`;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [books]);

  // 时间线条目滚动进入视野
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const items = listEl.querySelectorAll(".timeline-item");
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("visible", entry.isIntersecting);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [books, activeTag]);

  const filteredBooks = books
    .filter(
      (book) => activeTag === "全部" || book.tags.includes(activeTag),
    )
    .sort((a, b) => a.year - b.year);

  const favoriteBooks = books.filter((book) =>
    userData.favorites.includes(book.id),
  );

  // 每本书的公开书评（时间线展示最新两条，点击进入该书书评页并定位）
  const reviewsByBook = useMemo(() => {
    const map = new Map<string, TimelineReview[]>();
    for (const review of recentReviews) {
      const list = map.get(review.bookId);
      if (list) {
        list.push(review);
      } else {
        map.set(review.bookId, [review]);
      }
    }
    return map;
  }, [recentReviews]);

  const tags = ["全部", ...allTags];

  return (
    <>
      <main>
        <section className="hero section-block">
          <div className="hero-copy">
            <p className="eyebrow">[+] Suspense Archive</p>
            <Typewriter
              texts={[
                "沿着时间线，重走那些让人失眠的推理小说。",
                "每一本都是一场未完成的对话，等待被重新打开。",
              ]}
              deleteSpeed={55}
            />
            <p className="hero-text">
              这里收录本格、社会派、硬核与经典欧美推理。向下滚动，时间线会持续延伸；
              每一个节点都记录一部值得反复回味的谜题、动机与余韵。
            </p>
          </div>

          <div className="hero-panel">
            <div className="panel-row">
              <span>[x] atmosphere</span>
              <span>rain / low contrast / quiet motion</span>
            </div>
            <div className="panel-row">
              <span>[x] collection</span>
              <span>favorite / rate / note / revisit</span>
            </div>
            <div className="panel-row">
              <span>[x] topics</span>
              <span>author studies / series dossiers</span>
            </div>
          </div>
        </section>

        <section
          className="filters section-block"
          aria-labelledby="filters-title"
        >
          <div className="section-head">
            <div>
              <p className="eyebrow">[+] Filter Shelf</p>
              <h2 id="filters-title">按风格筛选</h2>
            </div>
            <p className="meta-text">
              {filteredBooks.length} 本书 / 当前筛选：{activeTag}
            </p>
          </div>
          <div className="tag-list" role="list">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-button${tag === activeTag ? " active" : ""}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <section
          className="timeline-section section-block"
          id="timeline"
          aria-labelledby="timeline-title"
        >
          <div className="section-head">
            <div>
              <p className="eyebrow">[+] Vertical Timeline</p>
              <h2 id="timeline-title">推荐书单</h2>
            </div>
            <p className="meta-text">按出版年份与阅读顺序向下展开</p>
          </div>

          <div className="timeline" id="timeline-root" ref={timelineRootRef}>
            <div className="timeline-line" aria-hidden="true">
              <div
                className="timeline-progress"
                id="timeline-progress"
                ref={timelineProgressRef}
              />
            </div>
            <div className="timeline-list" id="timeline-list" ref={listRef}>
              {filteredBooks.map((book, index) => {
                const layoutSide = index % 2 === 0 ? "left" : "right";
                const isFavorite = userData.favorites.includes(book.id);
                const rating = userData.ratings[book.id] ?? book.rating;
                const favoriteBusy = busyFavorites.has(book.id);
                const ratingBusy = busyRatings.has(book.id);
                const bookReviews = reviewsByBook.get(book.id) ?? [];

                return (
                  <article
                    key={book.id}
                    className={`timeline-item ${layoutSide}`}
                    data-book-id={book.id}
                  >
                    <div className="card-layout">
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

                      <div>
                        <div className="card-meta">
                          <span>[{book.year}]</span>
                          <span>{book.readTime}</span>
                          <span>{book.authorName}</span>
                        </div>

                        <div className="card-title-row">
                          <div>
                            <h3 className="card-title">{book.title}</h3>
                            <p className="meta-text">{book.seriesName}</p>
                          </div>
                          {isAuthed ? (
                            <button
                              type="button"
                              className={`favorite-button${isFavorite ? " active" : ""}`}
                              onClick={() => handleToggleFavorite(book.id)}
                              disabled={favoriteBusy}
                            >
                              {isFavorite ? "[x] 已收藏" : "[+] 加入收藏"}
                            </button>
                          ) : (
                            <Link
                              href="/login"
                              className="favorite-button"
                              style={{ display: "inline-block" }}
                            >
                              [+] 登录后收藏
                            </Link>
                          )}
                        </div>

                        <div className="card-links">
                          <Link
                            className="info-link"
                            href={`/topic?type=author&id=${book.authorId}`}
                          >
                            作者专题
                          </Link>
                          {book.seriesId ? (
                            <Link
                              className="info-link"
                              href={`/topic?type=series&id=${book.seriesId}`}
                            >
                              系列专题
                            </Link>
                          ) : null}
                        </div>

                        <p className="card-description">{book.blurb}</p>

                        <div className="tag-pills">
                          {book.tags.map((tag) => (
                            <span className="tag-pill" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="rating-row">
                          <span className="meta-text">评分</span>
                          <div className="star-group">
                            {Array.from({ length: 5 }, (_, index) => {
                              const value = index + 1;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={`star-button${value <= rating ? " active" : ""}`}
                                  data-star-value={value}
                                  aria-label={`评分 ${value} 星`}
                                  onClick={() => handleSetRating(book.id, value)}
                                  disabled={!isAuthed || ratingBusy}
                                >
                                  ★
                                </button>
                              );
                            })}
                          </div>
                          <span className="meta-text">{rating} / 5</span>
                        </div>

                        <div className="public-reviews">
                          <div className="public-reviews-head">
                            <p className="review-label">公开书评</p>
                            <Link
                              className="info-link"
                              href={`/books/${book.id}/reviews`}
                            >
                              全部书评 [{bookReviews.length}]
                            </Link>
                          </div>
                          {bookReviews.length === 0 ? (
                            <p className="meta-text">
                              还没有书评，去书评页抢沙发。
                            </p>
                          ) : (
                            bookReviews.slice(0, 2).map((review) => (
                              <Link
                                key={review.id}
                                className="timeline-review-link"
                                href={`/books/${book.id}/reviews#review-${review.id}`}
                              >
                                <span className="meta-text">
                                  {review.authorName} ·{" "}
                                  {formatDate(review.createdAt)}
                                </span>
                                <span className="timeline-review-excerpt">
                                  {review.excerpt}
                                </span>
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}