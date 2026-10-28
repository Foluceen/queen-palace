import Link from "next/link";

export function Pagination({ page, totalPages, basePath, params }: { page: number; totalPages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "page" && sp.set(k, v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="pagination" aria-label="Pages">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn--ghost btn--sm" rel="prev">
          Previous
        </Link>
      ) : null}
      <span className="small muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className="btn btn--ghost btn--sm" rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
