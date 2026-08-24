"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { setRating } from "@/app/actions/user-data";

type UserRatingProps = {
  bookId: string;
  initialRating: number | null;
  isAuthed: boolean;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; value: number }
  | { kind: "error"; message: string };

export function UserRating({
  bookId,
  initialRating,
  isAuthed,
}: UserRatingProps) {
  const [rating, setRatingValue] = useState(initialRating);
  const [preview, setPreview] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const fadeTimerRef = useRef(0);

  useEffect(
    () => () => window.clearTimeout(fadeTimerRef.current),
    [],
  );

  const handleSelect = useCallback(
    async (value: number) => {
      if (saveState.kind === "saving") return;
      const previous = rating;
      if (value === previous) return;

      window.clearTimeout(fadeTimerRef.current);
      setSaveState({ kind: "saving" });

      const result = await setRating(bookId, value);
      if (!result?.data || result.error) {
        // 以服务器结果为准：失败时回滚显示并提示
        setRatingValue(previous);
        setSaveState({
          kind: "error",
          message: result?.error ?? "保存失败，请稍后再试。",
        });
        return;
      }

      const saved = result.data.ratings[bookId] ?? value;
      setRatingValue(saved);
      setSaveState({ kind: "saved", value: saved });
      fadeTimerRef.current = window.setTimeout(
        () => setSaveState({ kind: "idle" }),
        2200,
      );
    },
    [bookId, rating, saveState.kind],
  );

  const display = preview > 0 ? preview : rating ?? 0;

  if (!isAuthed) {
    return (
      <div className="user-rating">
        <p className="eyebrow">[+] Your Rating</p>
        <p className="meta-text user-rating-hint">
          登录后即可评分 ·{" "}
          <Link className="info-link" href="/login">
            [+] 前往登录
          </Link>
        </p>
      </div>
    );
  }

  let hintText = rating ? "点击修改评分" : "点击评分";
  if (saveState.kind === "saving") hintText = "[~] 保存中";
  if (saveState.kind === "saved") hintText = `✓ 已保存 · ${saveState.value} / 5`;

  return (
    <div className="user-rating">
      <p className="eyebrow">[+] Your Rating</p>
      <div
        className="user-rating-row"
        onMouseLeave={() => setPreview(0)}
      >
        <div className="user-rating-stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`star-button${value <= display ? " active" : ""}`}
              aria-label={`评分 ${value} 星`}
              disabled={saveState.kind === "saving"}
              onMouseEnter={() => setPreview(value)}
              onFocus={() => setPreview(value)}
              onBlur={() => setPreview(0)}
              onClick={() => handleSelect(value)}
            >
              ★
            </button>
          ))}
        </div>
        <span className="user-rating-value">
          {display > 0 ? `${display} / 5` : "-- / 5"}
        </span>
      </div>
      <p
        className={`meta-text user-rating-hint${saveState.kind === "error" ? " error" : ""}${saveState.kind === "saved" ? " saved" : ""}`}
        aria-live="polite"
      >
        {saveState.kind === "error" ? saveState.message : hintText}
      </p>
    </div>
  );
}
