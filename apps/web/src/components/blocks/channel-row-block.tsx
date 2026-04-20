"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import type { BlockChannel } from "./types";

interface ChannelRowConfig {
  title?: string;
  badgeLabel?: string | null;
  orderBy?: "mostSubscribed" | "mostVideos" | "newest";
  limit?: number;
}

export function ChannelRowBlock({
  config,
  channels,
}: {
  config: ChannelRowConfig;
  channels: BlockChannel[];
}) {
  const title = config.title ?? "Empfohlene Kanäle";
  const badgeLabel = config.badgeLabel ?? "KANÄLE";
  const limit = config.limit ?? 8;

  let list = [...channels];
  if (config.orderBy === "mostVideos") {
    list.sort((a, b) => b._count.videos - a._count.videos);
  } else if (config.orderBy === "mostSubscribed") {
    list.sort((a, b) => b._count.subscriptions - a._count.subscriptions);
  }
  list = list.slice(0, limit);

  return (
    <section className="my-12">
      <header className="mb-5 flex items-end justify-between">
        <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight">
          <Icon name="user" size={20} className="text-brand" />
          {title}
          {badgeLabel ? (
            <span className="mono rounded bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
              {badgeLabel}
            </span>
          ) : null}
        </h2>
        <Link
          href="/channels"
          className="text-sm text-muted transition hover:text-brand"
        >
          Alle Kanäle →
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <p className="text-muted">Noch keine Kanäle verfügbar.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-brand/60 hover:bg-surface-raised"
              >
                {c.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.avatarUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-base font-bold text-neutral-900">
                    {c.displayName[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground group-hover:text-brand">
                    {c.displayName}
                  </p>
                  <p className="mono truncate text-[11px] text-dim">
                    @{c.slug}
                  </p>
                  <p className="mono mt-0.5 text-[10px] text-muted">
                    {c._count.subscriptions.toLocaleString("de-DE")} Abos · {c._count.videos} Videos
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
