import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div className="state">
        <h1 className="state__title">We couldn't find that page</h1>
        <p className="muted">It may have sold out or moved. Search for it, or browse every collection.</p>
        <div className="cluster">
          <Link href="/collections" className="btn">
            Browse collections
          </Link>
          <Link href="/search" className="btn btn--ghost">
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
