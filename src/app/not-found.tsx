import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="container" style={{ minHeight: "70vh", display: "grid", alignContent: "center" }}>
      <div className="state">
        <h1 className="state__title">We couldn't find that page</h1>
        <p className="muted">The link may be old, or the style may have sold out.</p>
        <div className="cluster">
          <Link href="/" className="btn">
            Go to the homepage
          </Link>
          <Link href="/collections" className="btn btn--ghost">
            Browse collections
          </Link>
        </div>
      </div>
    </main>
  );
}
