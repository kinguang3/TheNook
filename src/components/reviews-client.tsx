"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createReview,
  deleteReview,
  updateReview,
} from "@/app/actions/reviews";
import { REVIEW_MAX_LENGTH } from "@/lib/types";
import type { Book, Review } from "@/lib/types";
import { UserRating } from "@/components/user-rating";

type RatingStatView = {
  avgValue: number;
  ratingCount: number;
};

type ReviewsClientProps = {
  book: Book;
  initialReviews: Review[];
  currentUserId: string | null;
  initialUserRating: number | null;
  initialRatingStat: RatingStatView | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function ReviewsClient({
  book,
  initialReviews,
  currentUserId,
  initialUserRating,
  initialRatingStat,
}: ReviewsClientProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAuthed = Boolean(currentUserId);
  const trimmedLength = content.trim().length;
  const canSubmit =
    isAuthed && !submitting && trimmedLength > 0 && trimmedLength <= REVIEW_MAX_LENGTH;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError("");
    try {
      const result = await createReview(book.id, content);
      const created = result.review;
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (created) {
        setReviews((prev) => [created, ...prev]);
        setContent("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (review: Review) => {
    setEditingId(review.id);
    setEditContent(review.content);
    setFormError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (review: Review) => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed.length > REVIEW_MAX_LENGTH || editBusy) return;
    setEditBusy(true);
    try {
      const result = await updateReview(review.id, trimmed);
      const updated = result.review;
      if (updated) {
        // 仅更新内容与时间，保留原有作者昵称
        setReviews((prev) =>
          prev.map((entry) =>
            entry.id === review.id
              ? {
                  ...entry,
                  content: updated.content,
                  updatedAt: updated.updatedAt,
                }
              : entry,
          ),
        );
        cancelEdit();
      } else if (result.error) {
        setFormError(result.error);
      }
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async (review: Review) => {
    if (deletingId) return;
    if (!window.confirm("确定删除这条书评吗？")) return;
    setDeletingId(review.id);
    try {
      const result = await deleteReview(review.id);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setReviews((prev) => prev.filter((entry) => entry.id !== review.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <section className="section-block book-reviews-head">
        <p className="eyebrow">[+] Book Reviews</p>
        <h2 className="book-reviews-title">《{book.title}》</h2>
        <p className="meta-text">
          {book.authorName} / {book.year} / {book.seriesName}
        </p>
        <div className="reviews-rating-row">
          <div>
            <p className="eyebrow">[+] Rating</p>
            {initialRatingStat ? (
              <>
                <p className="rating-figure">
                  {initialRatingStat.avgValue.toFixed(1)} / 5
                </p>
                <p className="meta-text">
                  读者综合评分 · {initialRatingStat.ratingCount} 人参与
                </p>
              </>
            ) : (
              <>
                <p className="rating-figure">{book.rating.toFixed(1)} / 5</p>
                <p className="meta-text">档案评分</p>
              </>
            )}
          </div>
          <UserRating
            bookId={book.id}
            initialRating={initialUserRating}
            isAuthed={isAuthed}
          />
        </div>
        <div className="card-links">
          <Link className="info-link" href="/#timeline">
            ← 返回时间线
          </Link>
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
      </section>

      <section className="section-block" aria-labelledby="reviews-list-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">[+] Reviews</p>
            <h3 id="reviews-list-title">书评（{reviews.length}）</h3>
          </div>
          <p className="meta-text">按发表时间倒序排列</p>
        </div>

        {reviews.length === 0 ? (
          <p className="meta-text">还没有书评，来写下第一条吧。</p>
        ) : (
          <div className="review-list">
            {reviews.map((review) => {
              const isOwn = review.userId === currentUserId;
              const isEditing = editingId === review.id;

              return (
                <article
                  key={review.id}
                  id={`review-${review.id}`}
                  className="review-card"
                >
                  <div className="review-meta-row">
                    <span className="review-author">
                      [{isOwn ? "我" : "读者"}] {review.authorName}
                    </span>
                    <span className="meta-text">
                      {formatDate(review.createdAt)}
                      {review.updatedAt !== review.createdAt ? " · 已编辑" : ""}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="review-edit-box">
                      <textarea
                        className="review-textarea"
                        value={editContent}
                        maxLength={REVIEW_MAX_LENGTH}
                        onChange={(event) =>
                          setEditContent(event.target.value)
                        }
                        aria-label="编辑书评"
                      />
                      <div className="review-actions">
                        <button
                          type="button"
                          className="favorite-button active"
                          onClick={() => handleSaveEdit(review)}
                          disabled={
                            editBusy ||
                            !editContent.trim() ||
                            editContent.trim().length > REVIEW_MAX_LENGTH
                          }
                        >
                          {editBusy ? "[~] 保存中" : "[x] 保存"}
                        </button>
                        <button
                          type="button"
                          className="tag-button"
                          onClick={cancelEdit}
                          disabled={editBusy}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="review-content">{review.content}</p>
                      {isOwn ? (
                        <div className="review-actions">
                          <button
                            type="button"
                            className="tag-button"
                            onClick={() => startEdit(review)}
                            disabled={deletingId === review.id}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="tag-button"
                            onClick={() => handleDelete(review)}
                            disabled={deletingId === review.id}
                          >
                            {deletingId === review.id ? "[~] 删除中" : "删除"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        className="section-block"
        id="review-form"
        aria-labelledby="review-form-title"
      >
        <div className="section-head">
          <div>
            <p className="eyebrow">[+] New Review</p>
            <h3 id="review-form-title">写下你的书评</h3>
          </div>
        </div>

        {isAuthed ? (
          <div className="review-box">
            <textarea
              className="review-textarea"
              value={content}
              maxLength={REVIEW_MAX_LENGTH}
              placeholder={`关于《${book.title}》的判断、动机分析或余味……`}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              aria-label="书评内容"
            />
            <div className="review-form-foot">
              <span className="meta-text">
                {trimmedLength} / {REVIEW_MAX_LENGTH}
              </span>
              <button
                type="button"
                className="favorite-button"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? "[~] 发表中" : "[x] 发表评论"}
              </button>
            </div>
            {formError ? <p className="form-error">{formError}</p> : null}
          </div>
        ) : (
          <div className="review-gate">
            <p>请登录后发表评论。</p>
            <Link className="favorite-button" href="/login">
              [+] 前往登录
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
