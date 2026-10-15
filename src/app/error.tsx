"use client";

import Link from "next/link";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-wrap">
      <section className="section-block">
        <p className="eyebrow">[error / case disrupted]</p>
        <h1>页面出错了</h1>
        <p className="meta-text">
          渲染这条档案时发生异常。重试一次通常就能恢复；反复出现请稍后再来。
        </p>
        <p>
          <button type="button" className="button-link" onClick={reset}>
            重试
          </button>
        </p>
        <p>
          <Link className="info-link" href="/">
            返回时间线
          </Link>
        </p>
      </section>
    </main>
  );
}
