import Image from "next/image";
import Link from "next/link";
import { thumbnailUrl } from "@/lib/storage-urls";

export interface VideoCardData {
  id: string;
  slug: string;
  title: string;
  thumbnailKey: string | null;
  durationSec: number | null;
  viewCount: number;
  publishedAt: Date | string | null;
  channel: { slug: string; displayName: string };
}

export function formatDuration(sec: number | null): string | null {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatRelative(iso: Date | string | null): string {
  if (!iso) return "";
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Math.max(0, Date.now() - then.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} T.`;
  const w = Math.floor(d / 7);
  if (w < 4) return `vor ${w} Wo.`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `vor ${mo} Mon.`;
  return `vor ${Math.floor(d / 365)} J.`;
}

export function VideoCard({
  video,
  hrefSuffix = "",
}: {
  video: VideoCardData;
  hrefSuffix?: string;
}) {
  const duration = formatDuration(video.durationSec);
  const avatarChar = video.channel.displayName[0]?.toUpperCase() ?? "?";
  return (
    <Link
      href={`/watch/${video.slug}${hrefSuffix}`}
      className="group block"
    >
      <div className="relative aspect-video overflow-hidden rounded-[10px] border border-border bg-surface transition group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-card)]">
        {video.thumbnailKey ? (
          <Image
            src={thumbnailUrl(video.thumbnailKey)}
            alt={`${video.title} — Vorschaubild`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-surface-raised" />
        )}
        {duration && (
          <span className="mono absolute bottom-2 right-2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            {duration}
          </span>
        )}
      </div>
      <div className="flex gap-3 px-1 pt-3.5">
        <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-teal-400 to-teal-700" title={video.channel.displayName}>
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-neutral-900">
            {avatarChar}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground group-hover:text-brand">
            {video.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
            <span>{video.channel.displayName}</span>
            <span className="text-dim">·</span>
            <span className="mono">{video.viewCount} Views</span>
            {video.publishedAt && (
              <>
                <span className="text-dim">·</span>
                <span>{formatRelative(video.publishedAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
