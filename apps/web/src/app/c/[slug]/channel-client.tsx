"use client";

import { use, useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video-card";
import { SubscribeButton } from "@/components/subscribe-button";
import { CommunityTab } from "@/components/community-tab";
import { useSession } from "@/lib/auth-client";
import { thumbnailUrl, videoHlsUrl, assetUrl } from "@/lib/storage-urls";
import Hls from "hls.js";

// ─── Local types (TS2589 workaround for Prisma Json sectionOrder) ─────────────

interface SocialLink {
  platform: string;
  url: string;
}

interface ChannelData {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  about: string | null;
  socialLinks: SocialLink[];
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  sectionOrder: string[];
  featuredVideoId: string | null;
  trailerVideoId: string | null;
  ownerId: string;
  createdAt: string | Date;
  owner: { handle: string; displayName: string; role: string };
  _count: { videos: number; subscriptions: number };
  featuredVideo: FeaturedVideo | null;
  trailerVideo: TrailerVideo | null;
}

interface FeaturedVideo {
  id: string;
  slug: string;
  title: string;
  thumbnailKey: string | null;
  durationSec: number | null;
  viewCount: number;
  publishedAt: string | Date | null;
}

interface TrailerVideo {
  id: string;
  slug: string;
  title: string;
  thumbnailKey: string | null;
  durationSec: number | null;
}

interface VideoItem {
  id: string;
  slug: string;
  title: string;
  thumbnailKey: string | null;
  durationSec: number | null;
  viewCount: number;
  publishedAt: string | Date | null;
  status: string;
  visibility: string;
  format: "LONG" | "SHORT";
  channel: { slug: string; displayName: string };
}

const DEFAULT_SECTION_ORDER = ["featured", "latest", "shorts", "popular", "community", "about"];
const VALID_SECTIONS = new Set([
  "featured",
  "latest",
  "shorts",
  "popular",
  "playlists",
  "community",
  "about",
]);

function sanitizeOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_SECTION_ORDER;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k === "string" && VALID_SECTIONS.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out.length ? out : DEFAULT_SECTION_ORDER;
}

// ─── Trailer Player (autoplay muted, stops on click to watch) ────────────────

function TrailerPlayer({ video }: { video: TrailerVideo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const src = videoHlsUrl(video.id);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      el.play().catch(() => null);
      return;
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => null));
      hlsRef.current = hls;
      return () => { hls.destroy(); hlsRef.current = null; };
    }
    el.src = src;
    el.play().catch(() => null);
  }, [src]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        poster={video.thumbnailKey ? thumbnailUrl(video.thumbnailKey) : undefined}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 flex flex-col items-start justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-4">
        <span className="mb-1 rounded bg-channel-accent/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
          Trailer
        </span>
        <Link href={`/watch/${video.slug}`} className="text-sm font-semibold text-white hover:underline">
          {video.title}
        </Link>
      </div>
    </div>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function isPublicLive(v: VideoItem) {
  return v.status === "LIVE" && v.visibility === "PUBLIC";
}

function SectionLatest({
  videos,
  excludeIds,
}: {
  videos: VideoItem[];
  excludeIds: Set<string>;
}) {
  const latest = videos
    .filter((v) => v.format === "LONG" && isPublicLive(v) && !excludeIds.has(v.id))
    .slice(0, 12);
  if (!latest.length) return null;
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold tracking-tight">Neueste Videos</h2>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {latest.map((v) => <li key={v.id}><VideoCard video={v} /></li>)}
      </ul>
    </section>
  );
}

function SectionShorts({ videos }: { videos: VideoItem[] }) {
  const shorts = videos.filter((v) => v.format === "SHORT" && isPublicLive(v)).slice(0, 10);
  if (!shorts.length) return null;
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold tracking-tight">Shorts</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shorts.map((v) => (
          <Link
            key={v.id}
            href={`/shorts?v=${v.slug}`}
            className="group relative w-[140px] shrink-0 overflow-hidden rounded-xl bg-black"
          >
            <div className="aspect-[9/16] w-full overflow-hidden">
              {v.thumbnailKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl(v.thumbnailKey)}
                  alt={v.title}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full bg-surface-raised" />
              )}
            </div>
            <p className="absolute bottom-0 left-0 right-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] font-medium text-white">
              {v.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionPopular({ videos }: { videos: VideoItem[] }) {
  const popular = [...videos]
    .filter((v) => v.format === "LONG" && isPublicLive(v))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 8);
  if (!popular.length) return null;
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold tracking-tight">Beliebt</h2>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {popular.map((v) => <li key={v.id}><VideoCard video={v} /></li>)}
      </ul>
    </section>
  );
}

function SectionCommunity({ channelSlug }: { channelSlug: string }) {
  return (
    <section id="community">
      <h2 className="mb-4 text-lg font-bold tracking-tight">Community</h2>
      <CommunityTab slug={channelSlug} />
    </section>
  );
}

function SectionAbout({ channel }: { channel: ChannelData }) {
  const paragraphs = channel.about?.split("\n\n").filter(Boolean) ?? [];
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold tracking-tight">Über den Kanal</h2>
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        {paragraphs.length > 0 ? (
          <div className="space-y-3 text-sm text-muted leading-relaxed max-w-2xl">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        ) : channel.description ? (
          <p className="text-sm text-muted">{channel.description}</p>
        ) : (
          <p className="text-sm text-dim">Keine Beschreibung vorhanden.</p>
        )}
        {channel.socialLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {channel.socialLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
              >
                {link.platform}
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-dim">
          Kanal seit {new Date(channel.createdAt).toLocaleDateString("de-DE")}
          {" · "}
          {channel._count.videos} Videos
          {" · "}
          {channel._count.subscriptions} Abonnent:innen
        </p>
      </div>
    </section>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function ChannelPageClient({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const query = trpc.channel.getBySlug.useQuery({ slug });
  const { data: session } = useSession();
  const subscriptionStatus = trpc.subscription.isSubscribed.useQuery(
    { channelId: query.data?.channel.id ?? "" },
    { enabled: !!query.data && !!session },
  );

  if (query.isPending) {
    return (
      <main className="mx-auto max-w-[1440px] px-0">
        <div className="h-48 animate-pulse bg-surface" />
        <div className="px-6 py-8 md:px-8">
          <div className="h-6 w-48 animate-pulse rounded bg-surface" />
        </div>
      </main>
    );
  }
  if (query.error) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">
          {query.error.data?.code === "NOT_FOUND" ? "Kanal nicht gefunden" : "Fehler"}
        </h1>
        <p className="text-muted">{query.error.message}</p>
        <Link
          href="/"
          className="inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Zurück
        </Link>
      </main>
    );
  }

  if (!query.data) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Kanal nicht gefunden</h1>
        <Link
          href="/"
          className="inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Zurück
        </Link>
      </main>
    );
  }

  const rawData = query.data;
  const channel = rawData.channel as unknown as ChannelData;
  const videos = rawData.videos as unknown as VideoItem[];
  const { isOwnerOrAdmin } = rawData;

  const accent = channel.accentColor ?? null;
  const sectionOrder = sanitizeOrder(channel.sectionOrder);
  const avatarChar = channel.displayName[0]?.toUpperCase() ?? "?";
  const isSubscribed = subscriptionStatus.data?.subscribed === true;
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  const isOwn = sessionUserId === channel.ownerId;

  // accent: injiziert als CSS custom property auf section-level (kein XSS — hex-only via Zod)
  const accentStyle = accent
    ? ({ "--channel-accent": accent } as React.CSSProperties)
    : undefined;

  // Featured-Video aus Latest ausschließen, damit es nicht doppelt erscheint.
  const excludeFromLatest = new Set<string>(
    channel.featuredVideoId ? [channel.featuredVideoId] : [],
  );

  function renderSection(key: string) {
    switch (key) {
      case "featured":
        if (!channel.featuredVideo) return null;
        return (
          <section key="featured">
            <h2 className="mb-4 text-lg font-bold tracking-tight">Empfohlenes Video</h2>
            <VideoCard video={channel.featuredVideo as unknown as VideoItem} />
          </section>
        );
      case "latest":
        return <SectionLatest key="latest" videos={videos} excludeIds={excludeFromLatest} />;
      case "shorts":
        return <SectionShorts key="shorts" videos={videos} />;
      case "popular":
        return <SectionPopular key="popular" videos={videos} />;
      case "community":
        return <SectionCommunity key="community" channelSlug={channel.slug} />;
      case "about":
        return <SectionAbout key="about" channel={channel} />;
      default:
        return null;
    }
  }

  return (
    // eslint-disable-next-line react/forbid-dom-props
    <main id="main" style={accentStyle}>
      {/* ── Banner ── */}
      {channel.bannerUrl ? (
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-surface sm:aspect-[6/1]">
          <Image
            src={channel.bannerUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {accent && (
            // eslint-disable-next-line react/forbid-dom-props
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(to right, ${accent}33, transparent)`,
              }}
            />
          )}
        </div>
      ) : accent ? (
        // eslint-disable-next-line react/forbid-dom-props
        <div
          className="h-36 w-full"
          style={{
            background: `linear-gradient(135deg, ${accent}66 0%, ${accent}22 60%, transparent 100%)`,
          }}
        />
      ) : (
        <div className="h-36 w-full bg-gradient-to-r from-brand/20 via-brand/5 to-transparent" />
      )}

      {/* ── Channel header ── */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 md:px-8">
        <div className="-mt-10 mb-8 flex flex-col items-center gap-4 text-center sm:-mt-12 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5 sm:text-left">
          {/* Avatar */}
          <div className="relative shrink-0">
            {channel.avatarUrl ? (
              <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-background shadow-xl sm:h-24 sm:w-24">
                <Image
                  src={channel.avatarUrl}
                  alt={`${channel.displayName} Avatar`}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              // eslint-disable-next-line react/forbid-dom-props
              <div
                className="grid h-20 w-20 place-items-center rounded-full border-4 border-background text-2xl font-extrabold text-neutral-900 shadow-xl sm:h-24 sm:w-24 sm:text-3xl"
                style={
                  accent
                    ? { background: `linear-gradient(135deg, ${accent}, ${accent}88)` }
                    : undefined
                }
              >
                {!accent && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-400 to-teal-700" />
                )}
                <span className="relative z-10">{avatarChar}</span>
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="min-w-0 flex-1 sm:pt-12">
            <h1 className="text-2xl font-extrabold tracking-[-0.02em] sm:truncate sm:text-[26px]">
              {channel.displayName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted sm:justify-start">
              {/* eslint-disable-next-line react/forbid-dom-props */}
              <span className="mono" style={accent ? { color: accent } : undefined}>
                @{channel.slug}
              </span>
              <span className="text-dim">·</span>
              <span className="mono">{channel._count.subscriptions.toLocaleString("de-DE")} Abonnent:innen</span>
              <span className="text-dim">·</span>
              <span className="mono">{channel._count.videos} Videos</span>
              {channel.owner.role === "ADMIN" && (
                <>
                  <span className="text-dim">·</span>
                  {/* eslint-disable-next-line react/forbid-dom-props */}
                  <span
                    className="mono inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                    style={accent ? { background: `${accent}25`, color: accent } : undefined}
                  >
                    {!accent && <span className="inline-flex items-center rounded-full bg-brand/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand">Team</span>}
                    {accent && "Team"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 sm:pt-12">
            <SubscribeButton
              channelId={channel.id}
              channelOwnerId={channel.ownerId}
              accentColor={accent ?? undefined}
            />
            {isOwnerOrAdmin && (
              <Link
                href="/studio"
                className="rounded-md border border-border-strong px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-surface-raised"
              >
                Studio öffnen
              </Link>
            )}
          </div>
        </div>

        {/* ── Trailer (nur für Nicht-Subscriber) ── */}
        {channel.trailerVideo && !isOwn && !isSubscribed && (
          <div className="mb-10 max-w-md">
            <TrailerPlayer video={channel.trailerVideo} />
          </div>
        )}

        {/* ── Sections gemäß sectionOrder ── */}
        <div className="space-y-12 pb-16">
          {sectionOrder.map((key) => renderSection(key))}

          {/* Fallback: alle Videos für Owner wenn keine Section passt */}
          {isOwnerOrAdmin && videos.some((v) => v.visibility !== "PUBLIC") && (
            <section>
              <h2 className="mb-4 text-lg font-bold tracking-tight text-warning">
                Unveröffentlichte Videos (nur für dich sichtbar)
              </h2>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {videos
                  .filter((v) => v.visibility !== "PUBLIC")
                  .map((v) => (
                    <li key={v.id} className="relative">
                      <span className="mono absolute left-2 top-2 z-10 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning backdrop-blur">
                        {v.visibility}
                      </span>
                      <VideoCard video={v} />
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
