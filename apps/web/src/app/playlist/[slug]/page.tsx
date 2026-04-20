"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video-card";
import { Icon } from "@/components/icon";

export default function PlaylistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const q = trpc.playlist.bySlug.useQuery({ slug });

  if (q.isPending)
    return <main className="mx-auto max-w-5xl p-6 text-sm text-muted">Lädt …</main>;
  if (q.error)
    return (
      <main className="mx-auto max-w-5xl p-6 text-sm text-danger">
        {q.error.message}
      </main>
    );
  if (!q.data) return null;

  const { title, description, channel, items } = q.data;
  const first = items[0]?.video;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <nav className="mono mb-2 text-[11px] uppercase tracking-wider text-dim">
            <Link
              href={`/c/${channel.slug}`}
              className="text-dim hover:text-foreground"
            >
              @{channel.slug}
            </Link>{" "}
            / Playlist
          </nav>
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>
          )}
          <div className="mono mt-3 flex items-center gap-2 text-[11px] text-muted">
            <span>{items.length} Videos</span>
          </div>
        </div>
        {first && (
          <Link
            href={`/watch/${first.slug}?playlist=${slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-brand/90 [box-shadow:var(--shadow-glow)]"
          >
            <Icon name="play" size={14} strokeWidth={2.5} />
            Alle ansehen
          </Link>
        )}
      </header>

      <section>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Diese Playlist ist leer.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((i, idx) => (
              <li key={i.id} className="relative">
                <span className="mono absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                  #{idx + 1}
                </span>
                <VideoCard
                  video={{
                    id: i.video.id,
                    slug: i.video.slug,
                    title: i.video.title,
                    thumbnailKey: i.video.thumbnailKey,
                    durationSec: i.video.durationSec,
                    viewCount: i.video.viewCount,
                    publishedAt: i.video.publishedAt,
                    channel: i.video.channel,
                  }}
                  hrefSuffix={`?playlist=${slug}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
