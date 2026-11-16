export default function SearchLoading() {
  return (
    <main>
      <section className="search-hero section-block">
        <h1>档案检索</h1>
        <p className="meta-text" role="status">
          正在载入档案索引…
        </p>
        <div className="skeleton-stack" aria-hidden="true">
          <span className="skeleton-line skeleton-line-wide" />
        </div>
      </section>

      <section className="section-block" aria-hidden="true">
        <div className="skeleton-list">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="skeleton-card" key={index}>
              <span className="skeleton-line skeleton-line-title" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-line-wide" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
