"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { API_URL } from "@/lib/trpc";
import { assetUrl, thumbnailUrl } from "@/lib/storage-urls";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";

const SECTION_LABELS: Record<string, string> = {
  featured: "Featured",
  latest: "Neueste",
  shorts: "Shorts",
  popular: "Beliebt",
  playlists: "Playlists",
  about: "Über",
};
const ALL_SECTIONS = [
  "featured",
  "latest",
  "shorts",
  "popular",
  "playlists",
  "about",
];

export default function StudioBrandingPage() {
  return (
    <StudioGate>
      <Branding />
    </StudioGate>
  );
}

// Lokale Shape gegen Prisma-Json-Inference (TS2589). Gleiches Muster wie
// EditableVideo im Video-Editor.
interface MyChannel {
  id: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  sectionOrder: unknown;
  featuredVideoId: string | null;
  trailerVideoId: string | null;
}

function Branding() {
  const [tab, setTab] = useState<"assets" | "layout">("assets");
  const channel = trpc.channel.myChannel.useQuery();
  const rawChannelData = channel.data;
  const data = rawChannelData as unknown as MyChannel | undefined;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
          Branding
        </h1>
        <p className="mt-1 text-sm text-muted">
          Avatar, Banner und Layout deines Kanals.
        </p>
      </header>

      <div
        role="tablist"
        className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-0.5"
      >
        {(["assets", "layout"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              "rounded-md px-4 py-1.5 text-xs font-medium transition " +
              (tab === t
                ? "bg-brand text-neutral-900"
                : "text-dim hover:text-foreground")
            }
          >
            {t === "assets" ? "Assets" : "Layout"}
          </button>
        ))}
      </div>

      {channel.isPending ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : channel.error ? (
        <p className="text-sm text-danger">{channel.error.message}</p>
      ) : data ? (
        tab === "assets" ? (
          <AssetsTab
            channelId={data.id}
            avatarUrl={data.avatarUrl}
            bannerUrl={data.bannerUrl}
            onChange={() => channel.refetch()}
          />
        ) : (
          <LayoutTab
            channelId={data.id}
            slug={data.slug}
            accentColor={data.accentColor ?? null}
            sectionOrder={
              Array.isArray(data.sectionOrder)
                ? (data.sectionOrder as string[])
                : ALL_SECTIONS
            }
            featuredVideoId={data.featuredVideoId}
            trailerVideoId={data.trailerVideoId}
            onChange={() => channel.refetch()}
          />
        )
      ) : null}
    </div>
  );
}

// ─── Assets Tab ────────────────────────────────────────────────────────

function AssetsTab({
  channelId,
  avatarUrl,
  bannerUrl,
  onChange,
}: {
  channelId: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  onChange: () => void;
}) {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <AssetUploader
          kind="avatar"
          channelId={channelId}
          currentUrl={avatarUrl}
          onChange={onChange}
          acceptLabel="PNG/JPEG/WebP · max. 2 MB"
          aspect="square"
        />
        <AssetUploader
          kind="banner"
          channelId={channelId}
          currentUrl={bannerUrl}
          onChange={onChange}
          acceptLabel="PNG/JPEG/WebP · max. 4 MB · Empfehlung 2560×424"
          aspect="banner"
        />
      </div>

      <div>
        <div className="mono mb-2 text-[11px] uppercase tracking-wider text-dim">
          Vorschau
        </div>
        <ChannelHeaderPreview
          avatarUrl={avatarUrl}
          bannerUrl={bannerUrl}
        />
      </div>
    </section>
  );
}

function AssetUploader({
  kind,
  channelId,
  currentUrl,
  onChange,
  acceptLabel,
  aspect,
}: {
  kind: "avatar" | "banner";
  channelId: string;
  currentUrl: string | null;
  onChange: () => void;
  acceptLabel: string;
  aspect: "square" | "banner";
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const clearMut = trpc.channel.clearAsset.useMutation({
    onSuccess: () => {
      toast.success(`${kind === "avatar" ? "Avatar" : "Banner"} entfernt.`);
      onChange();
    },
    onError: (err) => toast.error(err.message),
  });

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bild-Dateien.");
      return;
    }
    const max = kind === "avatar" ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
    if (file.size > max) {
      toast.error(`Datei zu groß (max ${max / 1024 / 1024} MB).`);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      await uploadWithXhr(
        `${API_URL}/api/studio/${kind}`,
        file,
        (pct) => setProgress(pct),
      );
      toast.success(
        `${kind === "avatar" ? "Avatar" : "Banner"} hochgeladen.`,
      );
      onChange();
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">
          {kind === "avatar" ? "Avatar" : "Banner"}
        </h3>
        {currentUrl && (
          <button
            type="button"
            onClick={() => clearMut.mutate({ channelId, kind })}
            className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
          >
            <Icon name="trash" size={12} />
            Entfernen
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <AssetThumb url={currentUrl} aspect={aspect} />
        <div className="flex-1">
          <label
            htmlFor={`upload-${kind}`}
            className={
              "inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-medium transition hover:bg-surface " +
              (busy ? "pointer-events-none opacity-50" : "")
            }
          >
            <Icon name="upload" size={14} />
            {currentUrl ? "Ersetzen" : "Hochladen"}
          </label>
          <input
            id={`upload-${kind}`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            title={`${kind} Datei wählen`}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <p className="mt-2 text-[11px] text-dim">{acceptLabel}</p>
          {busy && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-raised">
              {/* eslint-disable-next-line react/forbid-dom-props */}
              <div
                className="h-full bg-brand transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetThumb({
  url,
  aspect,
}: {
  url: string | null;
  aspect: "square" | "banner";
}) {
  const sizeCls =
    aspect === "square" ? "h-20 w-20 rounded-full" : "h-16 w-40 rounded-md";
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt=""
        className={`${sizeCls} shrink-0 border border-border object-cover`}
      />
    );
  }
  return (
    <div
      className={`${sizeCls} grid shrink-0 place-items-center border border-dashed border-border bg-surface-raised text-dim`}
    >
      <Icon name={aspect === "square" ? "user" : "image"} size={24} />
    </div>
  );
}

function ChannelHeaderPreview({
  avatarUrl,
  bannerUrl,
}: {
  avatarUrl: string | null;
  bannerUrl: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div
        className="relative h-40 w-full bg-gradient-to-br from-teal-500 to-teal-800"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
      >
        {bannerUrl && (
          <div className="absolute inset-0 bg-black/10 [background-size:cover] [background-position:center]" />
        )}
      </div>
      <div className="flex items-end gap-4 p-5">
        <div className="-mt-10">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full border-4 border-surface object-cover"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-surface bg-gradient-to-br from-teal-400 to-teal-700 text-2xl font-bold text-neutral-900">
              ?
            </div>
          )}
        </div>
        <div>
          <div className="text-lg font-bold">Dein Kanal</div>
          <div className="text-xs text-muted">So sehen Besucher deine Seite</div>
        </div>
      </div>
    </div>
  );
}

function uploadWithXhr(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = xhr.statusText || `HTTP ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          // ignore parse
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler"));
    xhr.send(file);
  });
}

// ─── Layout Tab ────────────────────────────────────────────────────────

function LayoutTab({
  channelId,
  slug,
  accentColor,
  sectionOrder,
  featuredVideoId,
  trailerVideoId,
  onChange,
}: {
  channelId: string;
  slug: string;
  accentColor: string | null;
  sectionOrder: string[];
  featuredVideoId: string | null;
  trailerVideoId: string | null;
  onChange: () => void;
}) {
  const myVideos = trpc.video.mine.useQuery({ limit: 100 });
  const [color, setColor] = useState(accentColor ?? "#0fd3c2");
  const [useColor, setUseColor] = useState(!!accentColor);
  const [order, setOrder] = useState<string[]>(() =>
    sanitizeOrder(sectionOrder),
  );
  const [featured, setFeatured] = useState<string | "">(featuredVideoId ?? "");
  const [trailer, setTrailer] = useState<string | "">(trailerVideoId ?? "");

  useEffect(() => {
    setColor(accentColor ?? "#0fd3c2");
    setUseColor(!!accentColor);
    setOrder(sanitizeOrder(sectionOrder));
    setFeatured(featuredVideoId ?? "");
    setTrailer(trailerVideoId ?? "");
  }, [accentColor, sectionOrder, featuredVideoId, trailerVideoId]);

  const mut = trpc.channel.updateAppearance.useMutation({
    onSuccess: () => {
      toast.success("Layout gespeichert.");
      onChange();
    },
    onError: (err) => toast.error(err.message),
  });

  const liveVideos = (myVideos.data ?? []).filter((v) => v.status === "LIVE");

  function save() {
    mut.mutate({
      channelId,
      accentColor: useColor ? color : null,
      sectionOrder: order,
      featuredVideoId: featured || null,
      trailerVideoId: trailer || null,
    });
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setOrder(next);
  }

  function toggleSection(key: string) {
    if (order.includes(key)) {
      setOrder(order.filter((k) => k !== key));
    } else {
      setOrder([...order, key]);
    }
  }

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-5">
        {/* Accent Color */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-bold">Akzentfarbe</h3>
          <p className="mt-1 text-xs text-muted">
            Für Subscribe-Button, Featured-Badges und Kanal-Header-Gradient.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="checkbox"
              id="useColor"
              checked={useColor}
              onChange={(e) => setUseColor(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="useColor" className="text-sm">
              Eigene Farbe verwenden
            </label>
          </div>
          {useColor && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="color"
                title="Akzentfarbe"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded border border-border bg-surface"
              />
              <input
                type="text"
                title="Hex-Farbe"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                pattern="^#[0-9a-fA-F]{6}$"
                className="mono w-28 rounded-md border border-border bg-surface px-3 py-2 text-sm uppercase focus:border-brand focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Featured + Trailer */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-bold">Featured & Trailer</h3>
          <p className="mt-1 text-xs text-muted">
            Featured = gepinnt oben. Trailer = autoplay für Non-Subscriber.
          </p>
          <div className="mt-4 space-y-3">
            <VideoSelect
              id="featured"
              label="Featured-Video"
              value={featured}
              onChange={setFeatured}
              videos={liveVideos}
            />
            <VideoSelect
              id="trailer"
              label="Trailer-Video"
              value={trailer}
              onChange={setTrailer}
              videos={liveVideos}
            />
          </div>
        </div>

        {/* Section Order */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-bold">Sektions-Reihenfolge</h3>
          <p className="mt-1 text-xs text-muted">
            Ziehe Sektionen nach oben/unten oder blende sie aus.
          </p>
          <ul className="mt-4 space-y-2">
            {order.map((key, idx) => (
              <li
                key={key}
                className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2"
              >
                <span className="mono flex-1 text-sm">
                  {SECTION_LABELS[key] ?? key}
                </span>
                <button
                  type="button"
                  onClick={() => moveSection(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Nach oben"
                  className="rounded border border-border p-1 text-dim transition hover:bg-surface disabled:opacity-30"
                >
                  <Icon name="chevron-up" size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, 1)}
                  disabled={idx === order.length - 1}
                  aria-label="Nach unten"
                  className="rounded border border-border p-1 text-dim transition hover:bg-surface disabled:opacity-30"
                >
                  <Icon name="chevron-down" size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  aria-label="Ausblenden"
                  className="rounded border border-border p-1 text-dim transition hover:bg-surface"
                >
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
            {ALL_SECTIONS.filter((k) => !order.includes(k)).map((key) => (
              <li
                key={key}
                className="flex items-center gap-2 rounded-md border border-dashed border-border bg-surface/40 px-3 py-2"
              >
                <span className="mono flex-1 text-sm text-dim">
                  {SECTION_LABELS[key] ?? key} · ausgeblendet
                </span>
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  className="text-xs text-brand hover:underline"
                >
                  Einblenden
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={save}
            disabled={mut.isPending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand/90 disabled:opacity-50"
          >
            {mut.isPending ? "…" : "Layout speichern"}
          </button>
          <Link
            href={`/c/${slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-4 py-2 text-sm transition hover:bg-surface-raised"
          >
            Kanal-Seite öffnen
            <Icon name="external" size={12} />
          </Link>
        </div>
      </div>

      <div>
        <div className="mono mb-2 text-[11px] uppercase tracking-wider text-dim">
          Layout-Vorschau
        </div>
        <div
          className="overflow-hidden rounded-xl border border-border bg-surface"
          style={useColor ? { ["--channel-accent" as string]: color } : undefined}
        >
          <div
            className="h-24 w-full bg-gradient-to-br from-teal-500 to-teal-800"
            style={
              useColor
                ? { background: `linear-gradient(135deg, ${color}, #111)` }
                : undefined
            }
          />
          <div className="p-5 text-sm">
            {order.map((key) => {
              if (key === "featured" && featured) {
                const v = liveVideos.find((vv) => vv.id === featured);
                return (
                  <div key={key} className="mb-3">
                    <div className="mono text-[11px] uppercase tracking-wider text-dim">
                      Featured
                    </div>
                    <div className="mt-1 flex gap-2">
                      {v?.thumbnailKey && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={thumbnailUrl(v.thumbnailKey)}
                          alt=""
                          className="h-12 w-20 rounded object-cover"
                        />
                      )}
                      <span className="line-clamp-2 text-sm font-semibold">
                        {v?.title ?? "—"}
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={key} className="mb-2">
                  <span className="mono rounded bg-surface-raised px-2 py-0.5 text-[11px] text-dim">
                    {SECTION_LABELS[key] ?? key}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function VideoSelect({
  id,
  label,
  value,
  onChange,
  videos,
}: {
  id: string;
  label: string;
  value: string | "";
  onChange: (v: string | "") => void;
  videos: { id: string; title: string; status: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium text-foreground"
      >
        {label}
      </label>
      <select
        id={id}
        title={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
      >
        <option value="">— kein —</option>
        {videos.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function sanitizeOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of arr) {
    if (ALL_SECTIONS.includes(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out.length > 0 ? out : ALL_SECTIONS.slice();
}
