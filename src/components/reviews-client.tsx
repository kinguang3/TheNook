"use client";

import { memo, useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  createReview,
  deleteReview,
  updateReview,
} from "@/app/actions/reviews";
import { REVIEW_MAX_LENGTH } from "@/lib/types";
import type { Book, RatingStatView, Review } from "@/lib/types";
import { UserRating } from "@/components/user-rating";

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
  const [ratingStat, setRatingStat] = useState(initialRatingStat);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAuthed = Boolean(currentUserId);
  const deletingIdRef = useRef<string | null>(null);

  const startEdit = useCallback((reviewId: string) => {
    setEditingId(reviewId);
    setFormError("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleReviewSaved = useCallback(
    (
      reviewId: string,
      updated: Pick<Review, "id" | "content" | "updatedAt">,
    ) => {
      setReviews((prev) =>
        prev.map((entry) =>
          entry.id === reviewId
            ? {
                ...entry,
                content: updated.content,
                updatedAt: updated.updatedAt,
              }
            : entry,
        ),
      );
      setEditingId(null);
    },
    [],
  );

  const handleDelete = useCallback(async (review: Review) => {
    if (deletingIdRef.current) return;
    if (!window.confirm("确定删除这条书评吗？")) return;
    deletingIdRef.current = review.id;
    setDeletingId(review.id);
    try {
      const result = await deleteReview(review.id);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setReviews((prev) => prev.filter((entry) => entry.id !== review.id));
    } catch {
      setFormError("网络异常，删除未完成，请稍后再试。");
    } finally {
      deletingIdRef.current = null;
      setDeletingId(null);
    }
  }, []);

  return (
    <>
      <section className="section-block book-reviews-head">
        <h2 className="book-reviews-title">《{book.title}》</h2>
        <p className="meta-text">
          {book.authorName}　{book.year}　{book.seriesName}
        </p>
        <div className="reviews-rating-row">
          <div>
            {ratingStat ? (
              <>
                <p className="rating-figure">
                  {ratingStat.avgValue.toFixed(1)} / 5
                </p>
                <p className="meta-text">
                  读者综合评分，{ratingStat.ratingCount} 人参与
                </p>
              </>
            ) : book.rating > 0 ? (
              <>
                <p className="rating-figure">{book.rating.toFixed(1)} / 5</p>
                <p className="meta-text">档案评分</p>
              </>
            ) : (
              <>
                <p className="rating-figure">暂无评分</p>
                <p className="meta-text">还没有读者评分</p>
              </>
            )}
          </div>
          <UserRating
            bookId={book.id}
            initialRating={initialUserRating}
            isAuthed={isAuthed}
            onRatingChange={setRatingStat}
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
          {book.wikiUrl ? (
            <a
              className="info-link"
              href={book.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`在维基百科查看《${book.title}》（新窗口）`}
            >
              维基百科 ↗
            </a>
          ) : null}
        </div>
      </section>

      <section className="section-block" aria-labelledby="reviews-list-title">
        <div className="section-head">
          <div>
            <h3 id="reviews-list-title">书评（{reviews.length}）</h3>
          </div>
          <p className="meta-text">按发表时间倒序排列</p>
        </div>

        {reviews.length === 0 ? (
          <p className="meta-text">还没有书评，来写下第一条吧。</p>
        ) : (
          <div className="review-list">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isOwn={review.userId === currentUserId}
                isEditing={editingId === review.id}
                isDeleting={deletingId === review.id}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaved={handleReviewSaved}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
      </section>

      <ReviewComposer
        book={book}
        isAuthed={isAuthed}
        onCreated={(created) => setReviews((prev) => [created, ...prev])}
      />
    </>
  );
}

type ReviewCardProps = {
  review: Review;
  isOwn: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  onStartEdit: (reviewId: string) => void;
  onCancelEdit: () => void;
  onSaved: (
    reviewId: string,
    updated: Pick<Review, "id" | "content" | "updatedAt">,
  ) => void;
  onDelete: (review: Review) => void;
};

// 行级 memo：评分变化、删除态变化时，未受影响的评论不重渲染
const ReviewCard = memo(function ReviewCard({
  review,
  isOwn,
  isEditing,
  isDeleting,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onDelete,
}: ReviewCardProps) {
  return (
    <article id={`review-${review.id}`} className="review-card">
      <div className="review-meta-row">
        <span className="review-author">
          {review.authorName}
          {isOwn ? "（我）" : ""}
        </span>
        <span className="meta-text">
          {formatDate(review.createdAt)}
          {review.updatedAt !== review.createdAt ? "（已编辑）" : ""}
        </span>
      </div>

      {isEditing ? (
        <ReviewEditor
          review={review}
          onCancel={onCancelEdit}
          onSaved={(updated) => onSaved(review.id, updated)}
        />
      ) : (
        <>
          <p className="review-content">{review.content}</p>
          {isOwn ? (
            <div className="review-actions">
              <button
                type="button"
                className="tag-button"
                onClick={() => onStartEdit(review.id)}
                disabled={isDeleting}
              >
                编辑
              </button>
              <button
                type="button"
                className="tag-button"
                onClick={() => onDelete(review)}
                disabled={isDeleting}
              >
                {isDeleting ? "删除中…" : "删除"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
});

type ReviewEditorProps = {
  review: Review;
  onSaved: (review: Pick<Review, "id" | "content" | "updatedAt">) => void;
  onCancel: () => void;
};

// 编辑草稿也留在局部：输入时不会让整份书评列表跟着重渲染
function ReviewEditor({ review, onSaved, onCancel }: ReviewEditorProps) {
  const [content, setContent] = useState(review.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trimmed = content.trim();
  const canSave =
    !busy && trimmed.length > 0 && trimmed.length <= REVIEW_MAX_LENGTH;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateReview(review.id, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.updatedReview) {
        onSaved(result.updatedReview);
      } else {
        setError("修改未保存，请稍后再试。");
      }
    } catch {
      setError("网络异常，修改未保存，请稍后再试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="review-edit-box">
      <textarea
        className="review-textarea"
        value={content}
        maxLength={REVIEW_MAX_LENGTH}
        onChange={(event) => setContent(event.target.value)}
        aria-label="编辑书评"
      />
      <div className="review-actions">
        <button
          type="button"
          className="favorite-button active"
          onClick={handleSave}
          disabled={!canSave}
        >
          {busy ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          className="tag-button"
          onClick={onCancel}
          disabled={busy}
        >
          取消
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type ReviewComposerProps = {
  book: Book;
  isAuthed: boolean;
  onCreated: (review: Review) => void;
};

// 输入区独立持有草稿状态：打字时只重渲染这一段，不带动整份书评列表
function ReviewComposer({ book, isAuthed, onCreated }: ReviewComposerProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const trimmedLength = content.trim().length;
  const canSubmit =
    isAuthed && !submitting && trimmedLength > 0 && trimmedLength <= REVIEW_MAX_LENGTH;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError("");
    try {
      const result = await createReview(book.id, content);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (result.review) {
        onCreated(result.review);
        setContent("");
      }
    } catch {
      setFormError("网络异常，书评未发表，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="section-block"
      id="review-form"
      aria-labelledby="review-form-title"
    >
      <div className="section-head">
        <div>
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
              {submitting ? "发表中…" : "发表评论"}
            </button>
          </div>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="review-gate">
          <p>请登录后发表评论。</p>
          <Link className="favorite-button" href="/login">
            前往登录
          </Link>
        </div>
      )}
    </section>
  );
}
