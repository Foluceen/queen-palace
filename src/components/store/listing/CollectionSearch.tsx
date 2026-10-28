"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";

/** Search within the current collection. The query lives in ?q= so results are shareable. */
export function CollectionSearch({ collectionTitle }: { collectionTitle: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("q") ?? "";
  const [q, setQ] = useState(current);
  const [pending, startTransition] = useTransition();

  useEffect(() => setQ(current), [current]);

  const submit = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  };

  return (
    <form
      role="search"
      className={`csearch ${pending ? "is-pending" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
    >
      <Icon name="search" size={16} className="csearch__icon" />
      <input type="search" className="input csearch__input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${collectionTitle}`} aria-label={`Search within ${collectionTitle}`} />
      {current ? (
        <button
          type="button"
          className="icon-btn csearch__clear"
          aria-label="Clear search"
          onClick={() => {
            setQ("");
            submit("");
          }}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </form>
  );
}
