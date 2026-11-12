export default function ShelfLoading() {
  return (
    <main>
      <section className="section-block">
        <div className="section-head">
          <div>
            <h1>用户书架</h1>
          </div>
          <p className="meta-text" role="status">
            正在读取收藏与阅读进度…
          </p>
        </div>

        <div className="skeleton-list" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton-row" key={index}>
              <span className="skeleton-block skeleton-cover" />
              <span className="skeleton-stack">
                <span className="skeleton-line skeleton-line-wide" />
                <span className="skeleton-line skeleton-line-short" />
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
