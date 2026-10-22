import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <section className="section-block">
        <h1>档案不存在</h1>
        <p className="meta-text">
          这条链接指向的内容不在档案库中：可能已被移除，或链接本身有误。
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
