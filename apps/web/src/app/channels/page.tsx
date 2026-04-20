"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

type Sort = "mostSubscribed" | "mostVideos" | "newest" | "alphabetical";
const SORTS: { id: Sort; label: string }[] = [
  { id: "mostSubscribed", label: "Abonnenten" },
  { id: "mostVideos", label: "Videos" },
  { id: "newest", label: "Neueste" },
  { id: "alphabetical", label: "A–Z" },
];

export default function ChannelsPage() {
  const [orderBy, setOrderBy] = useState<Sort>("mostSubscribed");
  const [search, setSearch] = useState("");

  const channels = trpc.channel.list.useQuery({
    orderBy,
    search: search || undefined,
    limit: 60,
  });

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
            Kanäle
          </h1>
          <p className="mt-1 text-sm text-muted">
            Alle Creator auf ITSWEBER Play. Sortier- + Suchbar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Kanal suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          />
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setOrderBy(s.id)}
                className={
                  "rounded-md px-3 py-2 text-xs font-medium transition " +
                  (s.id === orderBy
                    ? "bg-brand/15 text-brand"
                    : "border border-border text-muted hover:bg-surface")
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {channels.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : channels.error ? (
        <p className="text-danger">{channels.error.message}</p>
      ) : channels.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <p className="text-muted">Keine Kanäle gefunden.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {channels.data.map((c) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.slug}`}
                className="block rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-lg font-bold text-neutral-900">
                    {c.displayName[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">
                      {c.displayName}
                    </div>
                    <div className="mono text-[11px] text-dim">@{c.slug}</div>
                    {c.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted">
                        {c.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mono mt-4 flex items-center justify-between text-[11px] text-dim">
                  <span>
                    <span className="text-foreground">{c._count.videos}</span>{" "}
                    Videos
                  </span>
                  <span>
                    <span className="text-foreground">
                      {c._count.subscriptions}
                    </span>{" "}
                    Abos
                  </span>
                  <span>
                    Seit {new Date(c.createdAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
