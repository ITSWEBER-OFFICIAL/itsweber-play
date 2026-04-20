"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { HlsPlayer } from "@/components/hls-player";
import { videoHlsUrl, thumbnailUrl } from "@/lib/storage-urls";
import { VideoCard, formatDuration } from "@/components/video-card";
import { SubscribeButton } from "@/components/subscribe-button";
import { Icon, type IconName } from "@/components/icon";
import { VideoActions } from "@/components/video-actions";
import { CommentsSection } from "@/components/comments-section";

type Chapter = { timeSec: number; title: string };

interface WatchVideo {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  chapters: unknown;
  commentsEnabled: boolean;
  status: string;
  visibility: string;
  thumbnailKey: string | null;
  durationSec: number | null;
  viewCount: number;
  failureReason: string | null;
  channel: {
    id: string;
    slug: string;
    displayName: string;
    ownerId: string;
  };
  category: { slug: string; name: string; icon: string | null } | null;
}

function secsToHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WatchPageClient({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const video = trpc.video.get.useQuery({ idOrSlug: slug });
  const status = video.data?.status;
  const videoId = video.data?.id;

  useEffect(() => {
    if (!status || status === "LIVE") return;
    const handle = window.setInterval(() => video.refetch(), 2000);
    return () => window.clearInterval(handle);
  }, [status]);

  const recordView = trpc.video.recordView.useMutation();
  const addHistory = trpc.history.add.useMutation();
  const { data: session } = useSession();

  useEffect(() => {
    if (!videoId || status !== "LIVE") return;
    const key = `play:viewed:${videoId}`;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    recordView.mutate({ id: videoId });
    // History-Eintrag nur für eingeloggte User.
    if (session) addHistory.mutate({ videoId });
  }, [videoId, status, session]);

  const related = trpc.video.list.useQuery({ limit: 12 });

  if (video.isPending) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-10 md:px-8">
        <div className="aspect-video animate-pulse rounded-xl bg-surface" />
      </main>
    );
  }

  if (video.error) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">
          {video.error.data?.code === "NOT_FOUND"
            ? "Video nicht gefunden"
            : video.error.data?.code === "FORBIDDEN"
              ? "Kein Zugriff"
              : "Fehler"}
        </h1>
        <p className="text-muted">{video.error.message}</p>
        <Link
          href="/"
          className="inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover"
        >
          Zurück zur Startseite
        </Link>
      </main>
    );
  }

  const v = video.data as unknown as WatchVideo;
  const channelInitial = v.channel.displayName[0]?.toUpperCase() ?? "?";
  const duration = formatDuration(v.durationSec);

  return (
    <main id="main" className="mx-auto max-w-[1440px] px-6 py-6 md:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {v.status !== "LIVE" ? (
            <ProcessingBanner v={v} />
          ) : (
            <HlsPlayer
              src={videoHlsUrl(v.id)}
              poster={
                v.thumbnailKey ? thumbnailUrl(v.thumbnailKey) : undefined
              }
            />
          )}

          <header className="mt-6 space-y-4">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
              {v.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold text-neutral-900">
                  {channelInitial}
                </div>
                <div>
                  <Link
                    href={`/c/${v.channel.slug}`}
                    className="font-semibold text-foreground hover:text-brand"
                  >
                    {v.channel.displayName}
                  </Link>
                  <div className="text-xs text-dim">
                    @{v.channel.slug}
                  </div>
                </div>
                <SubscribeButton
                  channelId={v.channel.id}
                  channelOwnerId={v.channel.ownerId}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="mono inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs uppercase tracking-wider text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {v.visibility}
                </span>
                <span className="mono text-muted">{v.viewCount} Views</span>
                {duration && (
                  <span className="mono text-muted">{duration}</span>
                )}
              </div>
            </div>

            <VideoActions videoId={v.id} videoSlug={v.slug} videoTitle={v.title} thumbnailKey={v.thumbnailKey} channelName={v.channel.displayName} channelSlug={v.channel.slug} />

            {(v.category || (v.tags && v.tags.length > 0)) && (
              <div className="flex flex-wrap items-center gap-2">
                {v.category && (
                  <Link
                    href={`/category/${v.category.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted transition hover:border-brand hover:text-brand"
                  >
                    {v.category.icon && (
                      <Icon name={v.category.icon as IconName} size={12} />
                    )}
                    {v.category.name}
                  </Link>
                )}
                {v.tags?.map((t) => (
                  <Link
                    key={t}
                    href={`/search?q=${encodeURIComponent(t)}`}
                    className="mono rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted transition hover:border-brand hover:text-brand"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {v.description && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="whitespace-pre-wrap text-sm text-muted">
                  {v.description}
                </p>
              </div>
            )}

            {(() => {
              const chs = (v.chapters as unknown as Chapter[] | null) ?? [];
              if (chs.length === 0) return null;
              return (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    Kapitel
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {chs.map((c) => (
                      <li
                        key={c.timeSec}
                        className="flex items-baseline gap-3"
                      >
                        <span className="mono w-14 text-brand">
                          {secsToHms(c.timeSec)}
                        </span>
                        <span className="text-muted">{c.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </header>

          <CommentsSection
            videoId={v.id}
            videoOwnerId={v.channel.ownerId}
            commentsEnabled={v.commentsEnabled}
          />
        </div>

        <aside className="min-w-0 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Weiter ansehen
          </h2>
          {related.isPending ? (
            <ul className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex animate-pulse gap-3">
                  <div className="h-[70px] w-[124px] shrink-0 rounded-md bg-surface" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-full rounded bg-surface" />
                    <div className="h-3 w-2/3 rounded bg-surface" />
                  </div>
                </li>
              ))}
            </ul>
          ) : related.data && related.data.length > 1 ? (
            <ul className="space-y-3">
              {related.data
                .filter((r) => r.id !== v.id)
                .slice(0, 8)
                .map((r) => (
                  <li key={r.id}>
                    <CompactVideoLink video={r} />
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-dim">Keine weiteren Videos.</p>
          )}
        </aside>
      </div>

      <section className="mt-14 border-t border-border pt-10 lg:hidden">
        <h2 className="mb-5 text-lg font-bold">Mehr entdecken</h2>
        {related.data && related.data.length > 0 && (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {related.data
              .filter((r) => r.id !== v.id)
              .slice(0, 6)
              .map((r) => (
                <li key={r.id}>
                  <VideoCard video={r} />
                </li>
              ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function CompactVideoLink({
  video,
}: {
  video: {
    id: string;
    slug: string;
    title: string;
    thumbnailKey: string | null;
    durationSec: number | null;
    channel: { displayName: string };
  };
}) {
  const duration = formatDuration(video.durationSec);
  return (
    <Link href={`/watch/${video.slug}`} className="group flex gap-3">
      <div className="relative h-[70px] w-[124px] shrink-0 overflow-hidden rounded-md border border-border bg-surface">
        {video.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl(video.thumbnailKey)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        {duration && (
          <span className="mono absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.5 text-[10px] font-semibold text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground group-hover:text-brand">
          {video.title}
        </h3>
        <p className="mt-1 text-xs text-muted">{video.channel.displayName}</p>
      </div>
    </Link>
  );
}

function ProcessingBanner({
  v,
}: {
  v: { status: string; title: string; failureReason: string | null };
}) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-center">
      <span
        className={
          "mono inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-wider " +
          (v.status === "FAILED"
            ? "bg-danger/20 text-danger"
            : "bg-brand/20 text-brand")
        }
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        {v.status}
      </span>
      <h2 className="mt-4 text-2xl font-bold">{v.title}</h2>
      {v.status === "FAILED" ? (
        <p className="mt-4 max-w-md text-sm text-danger">
          Transcoding fehlgeschlagen: {v.failureReason ?? "unbekannter Fehler"}
        </p>
      ) : (
        <p className="mt-4 max-w-md text-sm text-muted">
          Dein Video wird gerade zu HLS transkodiert. Die Seite aktualisiert
          sich automatisch, sobald der Player verfügbar ist.
        </p>
      )}
    </div>
  );
}
