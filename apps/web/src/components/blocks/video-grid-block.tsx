"use client";

import Link from "next/link";
import { VideoCard } from "@/components/video-card";
import type { BlockVideo } from "./types";

interface VideoGridConfig {
  title?: string;
  badgeLabel?: string | null;
  orderBy?: "latest" | "mostViewed";
  limit?: number;
  skipFeatured?: boolean;
}

export function VideoGridBlock({
  config,
  videos,
}: {
  config: VideoGridConfig;
  videos: BlockVideo[];
}) {
  const title = config.title ?? "Neueste Videos";
  const badgeLabel = config.badgeLabel ?? "LATEST";
  return (
    <section className="my-12">
      <header className="mb-5 flex items-end justify-between">
        <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight">
          {title}
          {badgeLabel ? (
            <span className="mono rounded bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
              {badgeLabel}
            </span>
          ) : null}
        </h2>
        <Link
          href="#"
          className="text-sm text-muted transition hover:text-brand"
        >
          Mehr →
        </Link>
      </header>

      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <p className="text-muted">Noch keine Videos in dieser Ansicht.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((v) => (
            <li key={v.id}>
              <VideoCard video={v} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
