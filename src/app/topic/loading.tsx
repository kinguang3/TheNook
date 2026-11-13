export default function TopicLoading() {
  return (
    <main>
      <section className="topic-hero section-block">
        <h1>专题</h1>
        <p className="meta-text" role="status">
          正在载入专题内容…
        </p>
        <div className="skeleton-stack" aria-hidden="true">
          <span className="skeleton-line skeleton-line-wide" />
          <span className="skeleton-line skeleton-line-short" />
        </div>
      </section>

      <section className="section-block" aria-hidden="true">
        <div className="topic-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="topic-card" key={index}>
              <div className="skeleton-stack">
                <span className="skeleton-line skeleton-line-short" />
                <span className="skeleton-line skeleton-line-title" />
                <span className="skeleton-line" />
                <span className="skeleton-line skeleton-line-wide" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
