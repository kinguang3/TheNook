"use client";

import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <title>页面出错了 | Casebook Timeline</title>
        <main className="auth-wrap">
          <section className="section-block">
            <h1>页面出错了</h1>
            <p className="meta-text">
              站点在渲染时发生异常。重试一次通常就能恢复；反复出现请稍后再来。
            </p>
            {error.digest ? (
              <p className="meta-text">错误编号：{error.digest}</p>
            ) : null}
            <p>
              <button type="button" className="button-link" onClick={retry}>
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
      </body>
    </html>
  );
}
