export default function BookReviewsLoading() {
  return (
    <main>
      <section className="section-block book-reviews-head">
        <p className="meta-text" role="status">
          正在载入这本书的书评…
        </p>
        <span className="skeleton-line skeleton-line-title" aria-hidden="true" />
        <span className="skeleton-line skeleton-line-wide" aria-hidden="true" />
      </section>

      <section className="section-block" aria-hidden="true">
        <div className="skeleton-list">
          {Array.from({ length: 2 }, (_, index) => (
            <div className="skeleton-card" key={index}>
              <span className="skeleton-line skeleton-line-short" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-line-wide" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
