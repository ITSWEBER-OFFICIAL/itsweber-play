"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import type { BlockChannel, BlockVideo, PageBlockData } from "@/components/blocks/types";

// Default-Blockliste, die gerendert wird, wenn die DB noch keine PageBlocks
// für "home" hat — bricht Greenfield-Installs nicht, Admin kann dann über
// /admin/page-blocks eigene Layouts komponieren.
const FALLBACK_BLOCKS: PageBlockData[] = [
  {
    id: "fallback-hero",
    pageSlug: "home",
    position: 0,
    type: "HERO",
    enabled: true,
    config: { badgeLabel: "Featured", ctaLabel: "Jetzt ansehen" },
    updatedAt: "",
  },
  {
    id: "fallback-chips",
    pageSlug: "home",
    position: 1,
    type: "CATEGORY_CHIPS",
    enabled: true,
    config: {
      items: [
        "Alle",
        "Smart Home",
        "3D-Druck",
        "Server & IT",
        "Docker",
        "Unraid",
        "Tutorials",
        "News",
        "Projekte",
      ],
    },
    updatedAt: "",
  },
  {
    id: "fallback-grid",
    pageSlug: "home",
    position: 2,
    type: "VIDEO_GRID",
    enabled: true,
    config: {
      title: "Neueste Videos",
      badgeLabel: "LATEST",
      orderBy: "latest",
      limit: 12,
      format: "LONG",
      skipFeatured: true,
    },
    updatedAt: "",
  },
  {
    id: "fallback-shorts",
    pageSlug: "home",
    position: 3,
    type: "SHORTS_ROW",
    enabled: true,
    config: {
      title: "Neueste Shorts",
      badgeLabel: "SHORTS",
      orderBy: "latest",
      limit: 10,
    },
    updatedAt: "",
  },
  {
    id: "fallback-channels",
    pageSlug: "home",
    position: 4,
    type: "CHANNEL_ROW",
    enabled: true,
    config: {
      title: "Empfohlene Kanäle",
      badgeLabel: "KANÄLE",
      orderBy: "mostSubscribed",
      limit: 8,
    },
    updatedAt: "",
  },
];

export default function HomePage() {
  const videos = trpc.video.list.useQuery({ limit: 48, format: "LONG" });
  const shorts = trpc.video.list.useQuery({ limit: 24, format: "SHORT" });
  const channels = trpc.channel.list.useQuery({ orderBy: "mostSubscribed" });
  const blocks = trpc.page.list.useQuery({ pageSlug: "home" });

  const activeBlocks =
    blocks.data && blocks.data.length > 0 ? blocks.data : FALLBACK_BLOCKS;
  const featured = (videos.data?.[0] ?? null) as BlockVideo | null;

  return (
    <main id="main" className="mx-auto max-w-[1440px] px-6 md:px-8">
      {videos.isPending || blocks.isPending ? (
        <GridSkeleton />
      ) : videos.error ? (
        <p className="mt-10 text-danger">API-Fehler: {videos.error.message}</p>
      ) : (
        <>
          {activeBlocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block as PageBlockData}
              videos={(videos.data ?? []) as BlockVideo[]}
              shorts={(shorts.data ?? []) as BlockVideo[]}
              channels={(channels.data ?? []) as unknown as BlockChannel[]}
              featuredVideo={featured}
            />
          ))}

          {(videos.data?.length ?? 0) === 0 && (shorts.data?.length ?? 0) === 0 && <EmptyHero />}
        </>
      )}
    </main>
  );
}

function GridSkeleton() {
  return (
    <div className="my-10 space-y-6">
      <div className="h-[440px] animate-pulse rounded-3xl border border-border bg-surface" />
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="animate-pulse space-y-3">
            <div className="aspect-video rounded-[10px] bg-surface" />
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-surface" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-5/6 rounded bg-surface" />
                <div className="h-3 w-3/4 rounded bg-surface" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyHero() {
  return (
    <section className="my-8 rounded-3xl border border-dashed border-border bg-surface/40 p-14 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        ITSWEBER <span className="text-brand">Play</span>
      </h1>
      <p className="mt-3 text-muted">
        Noch kein Video da — lade eins hoch, um die Startseite zu starten.
      </p>
      <Link
        href="/studio/upload"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover"
      >
        Video hochladen →
      </Link>
    </section>
  );
}
