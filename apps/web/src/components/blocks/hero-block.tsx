"use client";

import Image from "next/image";
import Link from "next/link";
import { formatDuration } from "@/components/video-card";
import { thumbnailUrl } from "@/lib/storage-urls";
import type { BlockVideo } from "./types";

interface HeroConfig {
  videoSlug?: string | null;
  badgeLabel?: string;
  ctaLabel?: string;
}

export function HeroBlock({
  config,
  video,
}: {
  config: HeroConfig;
  video: BlockVideo | null;
}) {
  if (!video) return null;
  const duration = formatDuration(video.durationSec);
  const badgeLabel = config.badgeLabel || "Featured";
  const ctaLabel = config.ctaLabel || "Jetzt ansehen";

  return (
    <section className="relative my-8 overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="grid min-h-[440px] grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative bg-black">
          {video.thumbnailKey ? (
            <Image
              src={thumbnailUrl(video.thumbnailKey)}
              alt={video.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover opacity-90"
            />
          ) : (
            <div className="h-full w-full bg-surface-raised" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-surface" />
          <Link
            href={`/watch/${video.slug}`}
            aria-label="Video abspielen"
            className="absolute left-1/2 top-1/2 grid h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand/90 text-neutral-900 transition hover:scale-105 [box-shadow:0_0_0_10px_color-mix(in_srgb,var(--color-brand)_18%,transparent),var(--shadow-lg)]"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </Link>
        </div>
        <div className="flex flex-col justify-center gap-4 p-10 lg:p-14">
          <div className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.1em] text-brand">
            <span className="inline-block h-0.5 w-7 bg-brand" />
            <span className="mono">{badgeLabel}</span>
          </div>
          <h1 className="text-[clamp(32px,3.6vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            {video.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-[11px] font-bold text-neutral-900">
              {video.channel.displayName[0]?.toUpperCase()}
            </div>
            <span>{video.channel.displayName}</span>
            {duration && (
              <>
                <span className="text-dim">·</span>
                <span className="mono text-brand">{duration}</span>
              </>
            )}
            <span className="text-dim">·</span>
            <span className="mono">{video.viewCount} Views</span>
          </div>
          <div className="mt-3 flex gap-3">
            <Link
              href={`/watch/${video.slug}`}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover [box-shadow:var(--shadow-glow)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
