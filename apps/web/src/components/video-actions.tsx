"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { Icon, type IconName } from "@/components/icon";

const REPORT_REASONS: { id: string; label: string }[] = [
  { id: "spam", label: "Spam oder Irreführung" },
  { id: "abuse", label: "Hass oder Belästigung" },
  { id: "copyright", label: "Urheberrechtsverletzung" },
  { id: "nudity", label: "Sexuelle Inhalte" },
  { id: "violence", label: "Gewalt" },
  { id: "dangerous", label: "Gefährliche Handlungen" },
  { id: "other", label: "Sonstiges" },
];

export function VideoActions({
  videoId,
  videoSlug,
  videoTitle = "",
  thumbnailKey = null,
  channelName = "",
  channelSlug = "",
}: {
  videoId: string;
  videoSlug: string;
  videoTitle?: string;
  thumbnailKey?: string | null;
  channelName?: string;
  channelSlug?: string;
}) {
  const { data: session } = useSession();
  const user = session?.user as { id?: string } | undefined;
  const utils = trpc.useUtils();

  const likeCount = trpc.reaction.countForVideo.useQuery({ videoId });
  const counts = trpc.reaction.counts.useQuery({ videoId });
  const mine = trpc.reaction.mine.useQuery({ videoId }, { enabled: !!user });
  const toggle = trpc.reaction.toggle.useMutation({
    onSuccess: () => {
      utils.reaction.countForVideo.invalidate({ videoId });
      utils.reaction.counts.invalidate({ videoId });
      utils.reaction.mine.invalidate({ videoId });
    },
    onError: (err) => toast.error(err.message),
  });

  const liked = mine.data?.liked === true;
  const myKind = (mine.data as { kind?: string } | undefined)?.kind ?? "LIKE";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {user ? (
        <ReactionButton
          liked={liked}
          myKind={myKind}
          totalCount={likeCount.data ?? 0}
          counts={counts.data ?? {}}
          pending={toggle.isPending}
          onToggle={(kind) => toggle.mutate({ videoId, kind })}
        />
      ) : (
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted transition hover:border-border-strong hover:text-foreground"
        >
          <Icon name="heart" size={16} />
          <span className="mono">{likeCount.data ?? 0}</span>
        </Link>
      )}

      <ShareButton
        slug={videoSlug}
        title={videoTitle}
        thumbnailKey={thumbnailKey}
        channelName={channelName}
        channelSlug={channelSlug}
      />

      {user && <WatchLaterButton videoId={videoId} />}
      {user && <ReportButton videoId={videoId} />}
    </div>
  );
}

type ReactionKind = "LIKE" | "FIRE" | "LOL" | "WOW" | "SAD";
const REACTION_KINDS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "LIKE", emoji: "❤", label: "Like" },
  { kind: "FIRE", emoji: "🔥", label: "Feuer" },
  { kind: "LOL", emoji: "😂", label: "Haha" },
  { kind: "WOW", emoji: "😮", label: "Wow" },
  { kind: "SAD", emoji: "😢", label: "Traurig" },
];

function ReactionButton({
  liked,
  myKind,
  totalCount,
  counts,
  pending,
  onToggle,
}: {
  liked: boolean;
  myKind: string;
  totalCount: number;
  counts: Record<string, number>;
  pending: boolean;
  onToggle: (kind: ReactionKind) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const startPress = () => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setPickerOpen(true);
    }, 400);
  };
  const cancelPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  const handleClick = () => {
    if (longPressFired.current) return;
    onToggle((myKind as ReactionKind) ?? "LIKE");
  };

  const active = REACTION_KINDS.find((r) => r.kind === myKind) ?? REACTION_KINDS[0]!;
  const sortedKinds = REACTION_KINDS.filter((r) => (counts[r.kind] ?? 0) > 0);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setPickerOpen((o) => !o);
        }}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        disabled={pending}
        aria-pressed={liked}
        aria-label="Reaktion (gedrückt halten für mehr Optionen)"
        className={
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 " +
          (liked
            ? "border-brand bg-brand/15 text-brand"
            : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground")
        }
      >
        <span aria-hidden className="text-base leading-none">
          {liked ? active.emoji : "♡"}
        </span>
        <span className="mono">{totalCount}</span>
      </button>
      {sortedKinds.length > 1 && (
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-dim" aria-label="Reaktions-Verteilung">
          {sortedKinds.map((r) => (
            <span key={r.kind} className="inline-flex items-center gap-0.5" title={`${r.label}: ${counts[r.kind]}`}>
              <span aria-hidden>{r.emoji}</span>
              <span className="mono">{counts[r.kind]}</span>
            </span>
          ))}
        </span>
      )}
      {pickerOpen && (
        <div
          role="menu"
          aria-label="Reaktion auswählen"
          className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-1 shadow-[var(--shadow-lg)] motion-reduce:transition-none"
        >
          {REACTION_KINDS.map((r) => (
            <button
              key={r.kind}
              type="button"
              role="menuitem"
              title={r.label}
              onClick={() => {
                onToggle(r.kind);
                setPickerOpen(false);
              }}
              className={
                "grid h-9 w-9 place-items-center rounded-full text-xl transition hover:scale-125 motion-reduce:hover:scale-100 " +
                (myKind === r.kind ? "bg-brand/20" : "")
              }
            >
              <span aria-hidden>{r.emoji}</span>
              <span className="sr-only">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WatchLaterButton({ videoId }: { videoId: string }) {
  const utils = trpc.useUtils();
  const { data } = trpc.watchLater.isSaved.useQuery({ videoId });
  const toggle = trpc.watchLater.toggle.useMutation({
    onSuccess: (res) => {
      toast.success(res.saved ? "Zu Später ansehen hinzugefügt" : "Aus Später ansehen entfernt");
      utils.watchLater.isSaved.invalidate({ videoId });
      utils.watchLater.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const saved = data?.saved === true;
  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ videoId })}
      disabled={toggle.isPending}
      aria-label={saved ? "Aus Später ansehen entfernen" : "Später ansehen"}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 " +
        (saved
          ? "border-brand bg-brand/15 text-brand"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground")
      }
    >
      <Icon name={saved ? "bookmark-filled" : "bookmark"} size={16} />
      {saved ? "Gespeichert" : "Später"}
    </button>
  );
}

interface ShareButtonProps {
  slug: string;
  title: string;
  thumbnailKey: string | null;
  channelName: string;
  channelSlug: string;
  // "pill" = Standard-Watch-Page-Layout. "compact" = runder Icon-Button
  // für Shorts-Action-Stack. Dropdown öffnet sich in beiden Modi nach unten.
  variant?: "pill" | "compact";
}

type ShareTab = "share" | "embed";

interface PlatformEntry {
  id: string;
  label: string;
  icon: IconName;
  copyOnly?: boolean;
  copyMsg?: string;
  href?: (url: string, title: string, thumb: string) => string;
}

const PLATFORMS: PlatformEntry[] = [
  {
    id: "twitter",
    label: "X / Twitter",
    icon: "brand-x",
    href: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: "brand-facebook",
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: "brand-linkedin",
    href: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    icon: "brand-reddit",
    href: (url, title) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: "brand-whatsapp",
    href: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: "brand-telegram",
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: "pinterest",
    label: "Pinterest",
    icon: "brand-pinterest",
    href: (url, title, thumb) =>
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(thumb)}&description=${encodeURIComponent(title)}`,
  },
  {
    id: "mail",
    label: "E-Mail",
    icon: "mail",
    href: (url, title) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: "brand-tiktok",
    copyOnly: true,
    copyMsg: "Link kopiert — füge ihn in deinem TikTok-Post ein",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: "brand-instagram",
    copyOnly: true,
    copyMsg: "Link kopiert — füge ihn in deiner Story oder Bio ein",
  },
];

export function ShareButton({ slug, title, thumbnailKey, channelName: _channelName, channelSlug: _channelSlug, variant = "pill" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ShareTab>("share");
  const [url, setUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [startAtEnabled, setStartAtEnabled] = useState(false);
  const [startAtSecs, setStartAtSecs] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(`${window.location.origin}/watch/${slug}`);
    // Try to get current video time from the page
    const video = document.querySelector("video");
    if (video) setStartAtSecs(Math.floor(video.currentTime));
    if (thumbnailKey) {
      const s3 = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "http://localhost:9000";
      setThumbUrl(`${s3}/play-thumbs/${thumbnailKey}`);
    }
  }, [slug, thumbnailKey, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const finalUrl = startAtEnabled && startAtSecs > 0 ? `${url}?t=${startAtSecs}` : url;
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const embedCode = `<iframe src="${siteUrl}/embed/${slug}${startAtEnabled && startAtSecs > 0 ? `?t=${startAtSecs}` : ""}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;

  const secsToMmss = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const mmssToSecs = (val: string): number => {
    const parts = val.split(":").map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    return 0;
  };

  const handleCopy = async (text: string, msg?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg ?? "Kopiert");
      setOpen(false);
    } catch {
      toast.error("Clipboard nicht verfügbar");
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {variant === "compact" ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Teilen"
          className="grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm transition active:scale-90"
        >
          <Icon name="share" size={22} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted transition hover:border-border-strong hover:text-foreground"
        >
          <Icon name="share" size={16} />
          Teilen
        </button>
      )}

      {open && (
        <div
          className={
            "absolute z-30 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)] " +
            (variant === "compact"
              ? "right-0 bottom-full mb-2 mt-0"
              : "right-0 top-full")
          }
          role="dialog"
          aria-label="Teilen"
        >
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["share", "embed"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  "flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition " +
                  (tab === t
                    ? "border-b-2 border-brand text-brand"
                    : "text-muted hover:text-foreground")
                }
              >
                {t === "share" ? "Teilen" : "Einbetten"}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-3">
            {/* Starten-bei Toggle */}
            <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={startAtEnabled}
                onChange={(e) => setStartAtEnabled(e.target.checked)}
                className="accent-[var(--color-brand)] h-3.5 w-3.5"
              />
              <Icon name="timestamp" size={14} className="text-muted" />
              <span className="flex-1 text-xs text-muted">Starten bei</span>
              {startAtEnabled && (
                <input
                  type="text"
                  value={secsToMmss(startAtSecs)}
                  onChange={(e) => setStartAtSecs(mmssToSecs(e.target.value))}
                  className="mono w-14 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
                  placeholder="00:00"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </label>

            {tab === "share" && (
              <>
                {/* Platform grid */}
                <div className="grid grid-cols-5 gap-1">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.label}
                      onClick={async () => {
                        if (p.copyOnly) {
                          await handleCopy(finalUrl, p.copyMsg);
                        } else if (p.href) {
                          window.open(p.href(finalUrl, title, thumbUrl), "_blank", "noopener,noreferrer");
                          setOpen(false);
                        }
                      }}
                      className="flex flex-col items-center gap-1 rounded-lg p-2 text-muted transition hover:bg-surface-raised hover:text-foreground"
                    >
                      <Icon name={p.icon} size={20} />
                      <span className="text-[9px] leading-tight">{p.label.split(" / ")[0]}</span>
                    </button>
                  ))}
                </div>

                {/* Copy-Link */}
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
                  <input
                    type="text"
                    readOnly
                    value={finalUrl}
                    aria-label="Video-Link"
                    className="mono min-w-0 flex-1 bg-transparent text-xs text-muted outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Link kopieren"
                    onClick={() => handleCopy(finalUrl, "Link kopiert")}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:bg-surface-hover hover:text-foreground"
                  >
                    <Icon name="copy" size={12} />
                  </button>
                </div>
              </>
            )}

            {tab === "embed" && (
              <div className="space-y-2">
                <textarea
                  readOnly
                  value={embedCode}
                  rows={4}
                  aria-label="Embed-Code"
                  className="mono w-full resize-none rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-muted outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(embedCode, "Embed-Code kopiert")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-raised hover:text-foreground"
                >
                  <Icon name="copy" size={13} />
                  Code kopieren
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportButton({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("spam");
  const [note, setNote] = useState("");

  const report = trpc.report.create.useMutation({
    onSuccess: () => {
      toast.success("Meldung eingegangen — Danke für deinen Hinweis.");
      setOpen(false);
      setNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted transition hover:border-danger hover:text-danger"
      >
        <Icon name="flag" size={16} />
        Melden
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">Video melden</h2>
            <p className="mt-1 text-xs text-muted">
              Die Meldung geht an die Moderation. Missbrauch kann deinen
              Account kosten.
            </p>

            <label className="mt-4 block text-xs">
              <span className="mb-1 block text-muted">Grund</span>
              <select
                aria-label="Meldungsgrund"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-foreground"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs">
              <span className="mb-1 block text-muted">
                Notiz (optional, max. 1000)
              </span>
              <textarea
                aria-label="Notiz"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-foreground"
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={report.isPending}
                onClick={() =>
                  report.mutate({
                    targetType: "VIDEO",
                    videoId,
                    reason: reason as
                      | "spam"
                      | "abuse"
                      | "copyright"
                      | "nudity"
                      | "violence"
                      | "dangerous"
                      | "other",
                    note: note.trim() || null,
                  })
                }
                className="rounded-md bg-danger px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                Melden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
