"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
  const [error, setError] = useState("");
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
    if (entry.error) {
      setError(entry.error);
      return;
    }
    if (entry.data) {
      // 服务端只回传变更的那本书，按 bookId 合并可保留其他书的乐观状态
      setShelf((prev) => ({ ...prev, ...entry.data }));
      setError("");
    }
  };

  const markBusy = (bookId: string, flag: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (flag) next.add(bookId);
      else next.delete(bookId);
      return next;
    });
  };

  const persistProgress = (bookId: string, progress: number) => {
    markBusy(bookId, true);
    void setProgress(bookId, progress)
      .then((result) => applyServerResult(result))
      .catch(() => setError("网络异常，阅读进度未保存。"))
      .finally(() => markBusy(bookId, false));
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
      setTimeout(() => {
        timersRef.current.delete(book.id);
        persistProgress(book.id, progress);
      }, 500),
    );
  };

  // 拖拽/键盘调整结束后立刻落库，避免用户马上离开页面时丢掉最后 500ms 内的改动
  const flushProgress = (book: Book, value?: number) => {
    if (!timersRef.current.has(book.id)) return;
    const timer = timersRef.current.get(book.id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(book.id);
    persistProgress(book.id, value ?? entryOf(book).progress);
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
    void setStatus(book.id, next)
      .then((result) => applyServerResult(result))
      // 网络异常时保留乐观状态，避免 busy 标志永久卡住按钮
      .catch(() => setError("网络异常，阅读状态未保存。"))
      .finally(() => markBusy(book.id, false));
  };

  const handleRemoveFromShelf = async (bookId: string) => {
    if (!isAuthed || busy.has(bookId)) return;
    markBusy(bookId, true);
    try {
      const result = await toggleFavorite(bookId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      const next = result?.data?.favoriteState;
      if (next?.bookId !== bookId) {
        setError("收藏状态未更新，请稍后再试。");
        return;
      }
      if (next.active) {
        setError("收藏状态已变化，请刷新后再试。");
        return;
      }
      setFavorites((prev) => prev.filter((id) => id !== bookId));
      setError("");
    } catch {
      setError("网络异常，未能移出书架。");
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

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entryOfInner = (book: Book) =>
      shelf[book.id] ?? {
        progress: 0,
        status: "unread" as const,
        lastReadAt: null,
      };
    return books
      .filter((book) => favoriteSet.has(book.id))
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
  }, [books, shelf, favoriteSet, query, filter]);

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
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="shelf-filters" role="group" aria-label="状态筛选">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              className={`tag-button${filter === key ? " active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="shelf-list">
        {rows.length === 0 ? (
          <div className="shelf-empty">
            <p>书架空空如也。</p>
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
                  <Image
                    src={book.coverUrl}
                    alt={`${book.title} 封面`}
                    fill
                    sizes="44px"
                  />
                ) : (
                  <span className="shelf-cover-mark">{book.coverMark}</span>
                )}
              </div>

              <div className="shelf-title">
                <Link
                  className="shelf-book-title shelf-book-link"
                  href={`/books/${book.id}/reviews`}
                >
                  {book.title}
                </Link>
                <span className="meta-text">{book.authorName}</span>
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
                {STATUS_LABEL[entry.status]}
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
                onPointerUp={(event) =>
                  flushProgress(book, Number(event.currentTarget.value))
                }
                onKeyUp={(event) =>
                  flushProgress(book, Number(event.currentTarget.value))
                }
                onBlur={(event) =>
                  flushProgress(book, Number(event.currentTarget.value))
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
                aria-label={`将《${book.title}》移出书架`}
              >
                移出书架
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}