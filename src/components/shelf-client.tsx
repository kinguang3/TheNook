"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { setProgress, setStatus } from "@/app/actions/shelf";
import { toggleFavorite } from "@/app/actions/user-data";
import type { Book, ShelfData, ShelfStatus } from "@/lib/types";

type ShelfClientProps = {
  books: Book[];
  initialShelf: ShelfData;
  initialFavorites: string[];
  isAuthed: boolean;
};

type Filter = "all" | ShelfStatus;

const STATUS_MARK: Record<ShelfStatus, string> = {
  unread: "[ ]",
  reading: "[+]",
  finished: "[x]",
};

const STATUS_LABEL: Record<ShelfStatus, string> = {
  unread: "未开始",
  reading: "阅读中",
  finished: "已读完",
};

const NEXT_STATUS: Record<ShelfStatus, ShelfStatus> = {
  unread: "reading",
  reading: "finished",
  finished: "unread",
};

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function ShelfClient({
  books,
  initialShelf,
  initialFavorites,
  isAuthed,
}: ShelfClientProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shelf, setShelf] = useState<ShelfData>(initialShelf);
  const [favorites, setFavorites] = useState<string[]>(initialFavorites);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const entryOf = (book: Book) =>
    shelf[book.id] ?? {
      progress: 0,
      status: "unread" as const,
      lastReadAt: null,
    };

  const applyServerResult = (result: unknown) => {
    if (!result || typeof result !== "object") return;
    const entry = result as { data?: ShelfData; error?: string };
    if (entry.data) setShelf(entry.data);
  };

  const markBusy = (bookId: string, flag: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (flag) next.add(bookId);
      else next.delete(bookId);
      return next;
    });
  };

  const handleProgressChange = (book: Book, value: number) => {
    if (!isAuthed) return;
    const progress = Math.min(Math.max(value, 0), 100);
    const status: ShelfStatus =
      progress >= 100 ? "finished" : progress > 0 ? "reading" : "unread";

    setShelf((prev) => ({
      ...prev,
      [book.id]: {
        progress,
        status,
        lastReadAt: prev[book.id]?.lastReadAt ?? null,
      },
    }));

    const timer = timersRef.current.get(book.id);
    if (timer) clearTimeout(timer);
    timersRef.current.set(
      book.id,
      setTimeout(async () => {
        markBusy(book.id, true);
        try {
          applyServerResult(await setProgress(book.id, progress));
        } finally {
          markBusy(book.id, false);
        }
      }, 500),
    );
  };

  const handleCycleStatus = (book: Book) => {
    if (!isAuthed || busy.has(book.id)) return;
    const current = entryOf(book).status;
    const next = NEXT_STATUS[current];

    setShelf((prev) => {
      const entry = prev[book.id];
      const base =
        entry ?? { progress: 0, status: "unread" as const, lastReadAt: null };
      const progress =
        next === "finished" ? 100 : next === "unread" ? 0 : base.progress;
      return {
        ...prev,
        [book.id]: { progress, status: next, lastReadAt: base.lastReadAt },
      };
    });

    markBusy(book.id, true);
    void setStatus(book.id, next).then((result) => {
      applyServerResult(result);
      markBusy(book.id, false);
    });
  };

  const handleRemoveFromShelf = async (bookId: string) => {
    if (!isAuthed || busy.has(bookId)) return;
    markBusy(bookId, true);
    try {
      const result = await toggleFavorite(bookId);
      if (result && typeof result === "object" && "data" in result) {
        const data = result.data;
        if (data) setFavorites(data.favorites);
      }
    } finally {
      markBusy(bookId, false);
    }
  };

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entryOfInner = (book: Book) =>
      shelf[book.id] ?? {
        progress: 0,
        status: "unread" as const,
        lastReadAt: null,
      };
    return books
      .filter((book) => favorites.includes(book.id))
      .map((book) => ({ book, entry: entryOfInner(book) }))
      .filter(({ book }) => {
        if (filter !== "all" && entryOfInner(book).status !== filter) {
          return false;
        }
        if (!q) return true;
        return (
          book.title.toLowerCase().includes(q) ||
          book.authorName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.entry.progress !== b.entry.progress) {
          return b.entry.progress - a.entry.progress;
        }
        return a.book.title.localeCompare(b.book.title, "zh-Hans-CN");
      });
  }, [books, shelf, favorites, query, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "reading", label: "阅读中" },
    { key: "finished", label: "已读完" },
    { key: "unread", label: "未开始" },
  ];

  return (
    <div className="shelf">
      <div className="shelf-toolbar">
        <input
          type="search"
          className="shelf-search"
          placeholder="按书名 / 作者搜索…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="搜索书架"
        />
        <div className="shelf-filters" role="tablist" aria-label="状态筛选">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`tag-button${filter === key ? " active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="shelf-list">
        {rows.length === 0 ? (
          <div className="shelf-empty">
            <p>[ ] 书架空空如也。</p>
            <p>
              {favorites.length === 0 ? (
                <Link className="info-link" href="/#timeline">
                  去时间线收藏第一本书 →
                </Link>
              ) : (
                "没有匹配当前筛选的书籍。"
              )}
            </p>
          </div>
        ) : (
          rows.map(({ book, entry }) => (
            <article className="shelf-row" key={book.id}>
              <div className="shelf-cover">
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={`${book.title} 封面`}
                    loading="lazy"
                  />
                ) : (
                  <span className="shelf-cover-mark">{book.coverMark}</span>
                )}
              </div>

              <div className="shelf-title">
                <span className="shelf-book-title">{book.title}</span>
                <span className="meta-text">— {book.authorName}</span>
              </div>

              <button
                type="button"
                className="shelf-status"
                onClick={() => handleCycleStatus(book)}
                disabled={!isAuthed || busy.has(book.id)}
                title={
                  isAuthed
                    ? `切换状态（当前：${STATUS_LABEL[entry.status]}）`
                    : "登录后可切换状态"
                }
                aria-label={`${book.title} 状态：${STATUS_LABEL[entry.status]}`}
              >
                {STATUS_MARK[entry.status]}
              </button>

              <div
                className="shelf-progress"
                role="progressbar"
                aria-valuenow={entry.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${book.title} 阅读进度`}
              >
                <div className="shelf-progress-track" aria-hidden="true">
                  <div
                    className="shelf-progress-fill"
                    style={{ width: `${entry.progress}%` }}
                  />
                </div>
                <span className="shelf-progress-value">{entry.progress}%</span>
              </div>

              <input
                type="range"
                className="shelf-range"
                min={0}
                max={100}
                step={5}
                value={entry.progress}
                onChange={(event) =>
                  handleProgressChange(book, Number(event.target.value))
                }
                disabled={!isAuthed || busy.has(book.id)}
                aria-label={`${book.title} 阅读进度调整`}
              />

              <span className="shelf-last-read">
                上次阅读 {formatDate(entry.lastReadAt)}
              </span>

              <button
                type="button"
                className="shelf-remove"
                onClick={() => handleRemoveFromShelf(book.id)}
                disabled={!isAuthed || busy.has(book.id)}
                title="移出书架（取消收藏）"
              >
                [x] 移出书架
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}