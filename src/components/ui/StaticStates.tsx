import Link from "next/link";

/** Server-renderable empty state (no client JS). */
export function EmptyStateStatic({ title, body, action }: { title: string; body?: string; action?: { label: string; href: string } }) {
  return (
    <div className="state" role="status">
      <h2 className="state__title">{title}</h2>
      {body ? <p className="muted">{body}</p> : null}
      {action ? (
        <Link className="btn" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
