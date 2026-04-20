"use client";

import Link from "next/link";
import { thumbnailUrl } from "@/lib/storage-urls";
import { Icon } from "@/components/icon";
import type { BlockVideo } from "./types";

interface ShortsRowConfig {
  title?: string;
  badgeLabel?: string | null;
  orderBy?: "latest" | "mostViewed";
  limit?: number;
}

export function ShortsRowBlock({
  config,
  videos,
}: {
  config: ShortsRowConfig;
  videos: BlockVideo[];
}) {
  const title = config.title ?? "Neueste Shorts";
  const badgeLabel = config.badgeLabel ?? "SHORTS";
  const limit = config.limit ?? 10;

  const list = config.orderBy === "mostViewed"
    ? [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, limit)
    : videos.slice(0, limit);

  return (
    <section className="my-12">
      <header className="mb-5 flex items-end justify-between">
        <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight">
          <Icon name="bolt" size={20} className="text-brand" />
          {title}
          {badgeLabel ? (
            <span className="mono rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">
              {badgeLabel}
            </span>
          ) : null}
        </h2>
        <Link
          href="/shorts"
          className="text-sm text-muted transition hover:text-brand"
        >
          Alle Shorts →
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <p className="text-muted">Noch keine Shorts verfügbar.</p>
        </div>
      ) : (
        <ul className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((v) => (
            <li key={v.id} className="shrink-0">
              <Link
                href={`/shorts?v=${v.slug}`}
                className="group relative block w-[180px] overflow-hidden rounded-xl bg-black"
              >
                <div className="aspect-[9/16] w-full overflow-hidden">
                  {v.thumbnailKey ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbnailUrl(v.thumbnailKey)}
                      alt={v.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-surface-raised text-dim">
                      <Icon name="bolt" size={32} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3">
                    <p className="line-clamp-2 text-[13px] font-bold leading-snug text-white">
                      {v.title}
                    </p>
                    <p className="mono mt-1 text-[10px] text-white/70">
                      @{v.channel.slug} · {v.viewCount.toLocaleString("de-DE")} Views
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
