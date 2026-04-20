"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { API_URL } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { thumbnailUrl, captionUrl } from "@/lib/storage-urls";
import { toast } from "@/lib/toast";
import { formatDuration } from "@/components/video-card";
import { Icon } from "@/components/icon";
import { InfoTooltip } from "@/components/info-tooltip";

const VISIBILITIES = [
  { id: "PUBLIC", label: "Public" },
  { id: "UNLISTED", label: "Unlisted" },
  { id: "LOGGED_IN", label: "Login" },
  { id: "PRIVATE", label: "Privat" },
] as const;

type Vis = (typeof VISIBILITIES)[number]["id"];
type Chapter = { timeSec: number; title: string };

// Narrow local shape for the editor — avoids the deep Prisma Json
// inference when TS tries to widen `trpc.video.getForEdit`'s response.
interface EditableVideo {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  chapters: unknown;
  commentsEnabled: boolean;
  categoryId: string | null;
  visibility: string;
  status: string;
  thumbnailKey: string | null;
  thumbnailCandidates: string[];
  durationSec: number | null;
  width: number | null;
  height: number | null;
  failureReason: string | null;
  format: "LONG" | "SHORT";
  createdAt: string | Date;
  publishedAt: string | Date | null;
  scheduledPublishAt: string | Date | null;
  channel: { slug: string; displayName: string };
}

export default function StudioVideoEditPage() {
  return (
    <StudioGate>
      <Editor />
    </StudioGate>
  );
}

function Editor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const video = trpc.video.getForEdit.useQuery({ id });
  const status = video.data?.status;

  // Während Transcode läuft, alle 2 s refetchen — separater Effect statt
  // refetchInterval-Option (deren tRPC-Signatur den TS-Compiler in eine
  // Infinite-Recursion treibt bei Prisma-Json-Feldern wie `chapters`).
  useEffect(() => {
    if (status !== "PROCESSING" && status !== "PENDING") return;
    const handle = window.setInterval(() => video.refetch(), 2000);
    return () => window.clearInterval(handle);
  }, [status]);
  const utils = trpc.useUtils();

  // Local draft state — wird aus Server-Response initialisiert.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [visibility, setVisibility] = useState<Vis>("PRIVATE");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [format, setFormat] = useState<"LONG" | "SHORT">("LONG");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersText, setChaptersText] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>(""); // datetime-local string

  const categories = trpc.category.list.useQuery();

  useEffect(() => {
    if (!video.data) return;
    // Cast once to a narrow shape so we sidestep the deep Prisma Json type
    // inference that otherwise blows out the TS compiler (TS2589).
    const v = video.data as unknown as EditableVideo;
    setTitle(v.title);
    setDescription(v.description ?? "");
    setTagsInput(v.tags.join(", "));
    setVisibility(v.visibility as Vis);
    setCommentsEnabled(v.commentsEnabled);
    setCategoryId(v.categoryId ?? null);
    setFormat(v.format ?? "LONG");
    const chs = (v.chapters as Chapter[] | null) ?? [];
    setChapters(chs);
    setChaptersText(
      chs
        .map((c) => `${secsToHms(c.timeSec)} ${c.title}`)
        .join("\n"),
    );
    if (v.scheduledPublishAt) {
      const d = new Date(v.scheduledPublishAt);
      // datetime-local-Input erwartet "YYYY-MM-DDTHH:MM" ohne Zeitzone.
      const pad = (n: number) => String(n).padStart(2, "0");
      setScheduledAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    } else {
      setScheduledAt("");
    }
  }, [video.data?.id]);

  const update = trpc.video.update.useMutation({
    onSuccess: () => {
      utils.video.getForEdit.invalidate({ id });
      utils.video.mine.invalidate();
      utils.video.list.invalidate();
      toast.success("Änderungen gespeichert");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteVideo = trpc.video.delete.useMutation({
    onSuccess: () => {
      toast.success("Video gelöscht");
      router.push("/studio/videos");
    },
    onError: (err) => toast.error(err.message),
  });

  function parseChapters(raw: string): Chapter[] {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const out: Chapter[] = [];
    for (const line of lines) {
      // Accept  "M:SS title" or "HH:MM:SS title".
      const m = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (!m) continue;
      const [, timeStr, title] = m;
      const timeSec = hmsToSecs(timeStr!);
      if (timeSec == null) continue;
      out.push({ timeSec, title: title!.trim() });
    }
    out.sort((a, b) => a.timeSec - b.timeSec);
    return out;
  }

  function save() {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const parsedChapters = parseChapters(chaptersText);
    const scheduledIso = scheduledAt
      ? new Date(scheduledAt).toISOString()
      : null;
    update.mutate({
      id,
      title: title.trim(),
      description: description.trim() || null,
      tags,
      visibility,
      commentsEnabled,
      categoryId,
      format,
      chapters: parsedChapters,
      scheduledPublishAt: scheduledIso,
    });
    setChapters(parsedChapters);
  }

  function onPickThumbnail(key: string) {
    update.mutate({ id, thumbnailKey: key });
  }

  if (video.isPending) {
    return <p className="text-muted">Editor lädt …</p>;
  }
  if (video.error) {
    return <p className="text-danger">Fehler: {video.error.message}</p>;
  }
  const v = video.data as unknown as EditableVideo;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <nav className="mono mb-1 text-[11px] uppercase tracking-wider text-dim">
            <Link href="/studio/videos" className="hover:text-brand">
              Studio / Videos
            </Link>{" "}
            / <span className="text-muted">Editor</span>
          </nav>
          <h1 className="truncate text-[24px] font-extrabold tracking-tight">
            {v.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="mono">{v.status}</span>
            {v.durationSec && (
              <>
                <span className="text-dim">·</span>
                <span className="mono">{formatDuration(v.durationSec)}</span>
              </>
            )}
            {v.width && v.height && (
              <>
                <span className="text-dim">·</span>
                <span className="mono">
                  {v.width}×{v.height}
                </span>
              </>
            )}
            <span className="text-dim">·</span>
            <Link
              href={`/watch/${v.slug}`}
              target="_blank"
              className="text-brand hover:underline"
            >
              Ansehen →
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `„${v.title}" löschen? Kann nicht rückgängig gemacht werden.`,
                )
              ) {
                deleteVideo.mutate({ id });
              }
            }}
            className="rounded-md border border-border-strong bg-surface px-3.5 py-2 text-sm font-medium text-muted transition hover:border-danger hover:text-danger"
          >
            Löschen
          </button>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60 [box-shadow:var(--shadow-glow)]"
          >
            {update.isPending ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </header>

      {v.status === "FAILED" && v.failureReason && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          Transcoding fehlgeschlagen: {v.failureReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── LEFT: Metadata-Form ─────────────────────────── */}
        <div className="space-y-6">
          <Card title="Metadaten">
            <Field label="Titel">
              <input
                type="text"
                aria-label="Titel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              />
            </Field>

            <Field label="Beschreibung">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={10_000}
                rows={6}
                className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
                placeholder="Worum geht's in diesem Video? Links, Kapitel, Credits."
              />
              <div className="mono mt-1 text-[10px] text-dim">
                {description.length}/10000
              </div>
            </Field>

            <Field
              label="Tags"
              tooltip="Komma-separierte Stichworte (max. 20, je 40 Zeichen). Tags helfen beim Suchen und werden in der Kategorie-Filterung berücksichtigt."
              helpHref="/help#tags"
            >
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="unraid, homelab, smart-home"
                className="mono w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              />
            </Field>

            <Field label="Kategorie">
              <select
                aria-label="Kategorie"
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              >
                <option value="">— keine Kategorie —</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Format"
              tooltip="Video = Querformat, normaler Feed. Short = Hochformat (9:16), erscheint im /shorts-Karussell. Der Worker erkennt das Format auch automatisch."
              helpHref="/help#format"
            >
              <div
                role="tablist"
                aria-label="Format"
                className="inline-flex overflow-hidden rounded-md border border-border bg-surface-raised p-0.5"
              >
                {(
                  [
                    { key: "LONG" as const, label: "Video" },
                    { key: "SHORT" as const, label: "Short" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="tab"
                    aria-selected={format === opt.key}
                    onClick={() => setFormat(opt.key)}
                    className={
                      "rounded px-4 py-1.5 text-xs font-medium transition " +
                      (format === opt.key
                        ? opt.key === "SHORT"
                          ? "bg-purple-500/30 text-purple-200"
                          : "bg-brand text-neutral-900"
                        : "text-dim hover:text-foreground")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mono mt-1.5 text-[10px] text-dim">
                Shorts erscheinen im /shorts-Feed (9:16-Karussell). Long-Form
                bleibt im normalen Video-Feed.
              </p>
            </Field>
          </Card>

          <Card title="Kapitel">
            <p className="mb-2 text-[11px] text-muted">
              Je Zeile: <span className="mono">MM:SS Titel</span> oder{" "}
              <span className="mono">HH:MM:SS Titel</span>. Automatisch sortiert.
            </p>
            <textarea
              value={chaptersText}
              onChange={(e) => setChaptersText(e.target.value)}
              onBlur={() => setChapters(parseChapters(chaptersText))}
              rows={6}
              className="mono w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-xs text-foreground outline-none focus:border-brand"
              placeholder="00:00 Intro&#10;01:20 Problem&#10;04:45 Lösung"
            />
            {chapters.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs">
                {chapters.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="mono text-brand">
                      {secsToHms(c.timeSec)}
                    </span>
                    <span className="truncate text-muted">{c.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Sichtbarkeit & Kommentare">
            <Field
              label="Sichtbarkeit"
              tooltip="Public = für alle sichtbar. Unlisted = nur über direkten Link erreichbar. Login = nur für eingeloggte User. Privat = nur du."
              helpHref="/help#visibility"
            >
              <div className="flex flex-wrap gap-1.5">
                {VISIBILITIES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setVisibility(o.id)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium transition " +
                      (visibility === o.id
                        ? "border-brand bg-brand/15 text-brand"
                        : "border-border bg-surface-raised text-muted hover:border-border-strong")
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Für später planen"
              tooltip="Datum/Uhrzeit in der Zukunft — der Worker schaltet das Video zur genannten Zeit automatisch auf PUBLIC und benachrichtigt Abonnenten. Leer lassen für sofort."
            >
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  aria-label="Geplanter Veröffentlichungszeitpunkt"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
                />
                {scheduledAt && (
                  <button
                    type="button"
                    onClick={() => setScheduledAt("")}
                    className="text-[11px] text-muted hover:text-danger"
                  >
                    Löschen
                  </button>
                )}
              </div>
              {scheduledAt && (
                <p className="mono mt-1 text-[10px] text-dim">
                  Geplant für {new Date(scheduledAt).toLocaleString("de-DE")}
                </p>
              )}
            </Field>

            <Field
              label="Kommentare"
              tooltip="Erlauben = Zuschauer können kommentieren. Sperren = keine neuen Kommentare möglich (bestehende bleiben sichtbar)."
            >
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCommentsEnabled(true)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition " +
                    (commentsEnabled
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border bg-surface-raised text-muted")
                  }
                >
                  Erlauben
                </button>
                <button
                  type="button"
                  onClick={() => setCommentsEnabled(false)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition " +
                    (!commentsEnabled
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border bg-surface-raised text-muted")
                  }
                >
                  Sperren
                </button>
              </div>
            </Field>
          </Card>
        </div>

        {/* ── RIGHT: Thumbnails + Meta ────────────────────── */}
        <div className="space-y-6">
          <Card title="Thumbnail">
            {v.thumbnailCandidates.length === 0 ? (
              <p className="text-xs text-muted">
                {v.status === "PROCESSING" || v.status === "PENDING"
                  ? "Kandidaten werden vom Worker generiert … (aktualisiert sich)"
                  : "Keine Kandidaten vorhanden."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {v.thumbnailCandidates.map((key) => {
                  const active = v.thumbnailKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onPickThumbnail(key)}
                      className={
                        "aspect-video overflow-hidden rounded-md border transition " +
                        (active
                          ? "border-brand ring-2 ring-brand/40"
                          : "border-border hover:border-border-strong")
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnailUrl(key)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
            <CustomThumbnailUpload
              videoId={v.id}
              onUploaded={() => video.refetch()}
            />
          </Card>

          <Card title="Untertitel">
            <CaptionsPanel videoId={v.id} />
          </Card>

          <Card title="Schneiden">
            <p className="text-xs text-muted">
              Original auf einen Ausschnitt zurechtschneiden. Überschreibt die
              Quelldatei und startet Transcode neu.
            </p>
            <Link
              href={`/studio/${v.id}/trim`}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-medium transition hover:bg-surface"
            >
              <Icon name="scissors" size={12} />
              Trim-Editor öffnen
            </Link>
          </Card>

          <Card title="Details">
            <div className="space-y-1.5 text-xs">
              <Detail label="Slug" value={v.slug} mono />
              <Detail
                label="Angelegt"
                value={new Date(v.createdAt).toLocaleDateString("de-DE")}
              />
              {v.publishedAt && (
                <Detail
                  label="Veröffentlicht"
                  value={new Date(v.publishedAt).toLocaleDateString("de-DE")}
                />
              )}
              <Detail label="Kanal" value={v.channel.displayName} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  tooltip,
  helpHref,
  children,
}: {
  label: string;
  tooltip?: string;
  helpHref?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
        {tooltip && <InfoTooltip content={tooltip} helpHref={helpHref} />}
      </span>
      {children}
    </label>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-dim">{label}</span>
      <span className={mono ? "mono text-foreground" : "text-foreground"}>
        {value}
      </span>
    </div>
  );
}

// ─── Chapter time parsing ───────────────────────────────────────────────

function hmsToSecs(s: string): number | null {
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
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

function parseChapters(raw: string): Chapter[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: Chapter[] = [];
  for (const line of lines) {
    const m = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (!m) continue;
    const [, timeStr, title] = m;
    const timeSec = hmsToSecs(timeStr!);
    if (timeSec == null) continue;
    out.push({ timeSec, title: title!.trim() });
  }
  out.sort((a, b) => a.timeSec - b.timeSec);
  return out;
}


// ─── Custom Thumbnail Upload ─────────────────────────────────────────────

function CustomThumbnailUpload({
  videoId,
  onUploaded,
}: {
  videoId: string;
  onUploaded: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${API_URL}/api/studio/video/${videoId}/thumbnail`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": file.type },
          body: file,
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Thumbnail gesetzt.");
      onUploaded();
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <label
        htmlFor={`thumb-upload-${videoId}`}
        className={
          "inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium transition hover:bg-surface " +
          (busy ? "pointer-events-none opacity-50" : "")
        }
      >
        <Icon name="upload" size={12} />
        {busy ? "Lädt …" : "Eigenes Bild hochladen"}
      </label>
      <input
        id={`thumb-upload-${videoId}`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        title="Thumbnail-Datei wählen"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <p className="mt-1 text-[10px] text-dim">
        PNG/JPEG/WebP · max. 2 MB
      </p>
    </div>
  );
}

// ─── Captions Panel ─────────────────────────────────────────────────────

function CaptionsPanel({ videoId }: { videoId: string }) {
  const captions = trpc.video.captions.list.useQuery({ videoId });
  const utils = trpc.useUtils();
  const [lang, setLang] = useState("de");
  const [label, setLabel] = useState("Deutsch");
  const [busy, setBusy] = useState(false);

  const setDefault = trpc.video.captions.setDefault.useMutation({
    onSuccess: () => {
      toast.success("Standard gesetzt.");
      captions.refetch();
    },
  });
  const remove = trpc.video.captions.remove.useMutation({
    onSuccess: () => {
      toast.success("Entfernt.");
      captions.refetch();
    },
  });

  async function upload(file: File) {
    if (!lang.match(/^[a-z]{2}$/i)) {
      toast.error("Sprache muss ISO 639-1 sein (de, en, fr, …).");
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Max 1 MB.");
      return;
    }
    setBusy(true);
    try {
      const isVtt = file.name.endsWith(".vtt");
      const contentType = isVtt ? "text/vtt" : "application/x-subrip";
      const url = `${API_URL}/api/studio/video/${videoId}/caption?lang=${encodeURIComponent(
        lang,
      )}&label=${encodeURIComponent(label)}`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Caption hochgeladen.");
      captions.refetch();
      utils.video.captions.list.invalidate({ videoId });
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {captions.isPending ? (
        <p className="text-xs text-muted">Lädt …</p>
      ) : (captions.data ?? []).length === 0 ? (
        <p className="text-xs text-muted">Noch keine Untertitel.</p>
      ) : (
        <ul className="space-y-1.5">
          {captions.data!.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs"
            >
              <span className="mono uppercase text-dim">{c.language}</span>
              <span className="flex-1 truncate">{c.label}</span>
              {c.isAutoGenerated && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-dim">
                  Auto
                </span>
              )}
              {c.isDefault ? (
                <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                  default
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDefault.mutate({ captionId: c.id })}
                  className="text-[10px] text-brand hover:underline"
                >
                  als default
                </button>
              )}
              <button
                type="button"
                onClick={() => remove.mutate({ captionId: c.id })}
                aria-label="Entfernen"
                className="text-danger transition hover:opacity-70"
              >
                <Icon name="trash" size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 border-t border-border pt-3">
        <input
          type="text"
          value={lang}
          onChange={(e) => setLang(e.target.value.toLowerCase())}
          maxLength={2}
          placeholder="de"
          title="ISO 639-1 Sprachcode"
          aria-label="Sprachcode"
          className="mono w-14 rounded-md border border-border bg-surface px-2 py-1.5 text-xs uppercase focus:border-brand focus:outline-none"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder="Deutsch"
          title="Anzeigename"
          aria-label="Anzeigename"
          className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
        />
      </div>

      <label
        htmlFor={`cap-upload-${videoId}`}
        className={
          "inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium transition hover:bg-surface " +
          (busy ? "pointer-events-none opacity-50" : "")
        }
      >
        <Icon name="upload" size={12} />
        {busy ? "Lädt …" : "VTT/SRT hochladen"}
      </label>
      <input
        id={`cap-upload-${videoId}`}
        type="file"
        accept=".vtt,.srt,text/vtt,application/x-subrip"
        title="Caption-Datei wählen"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <p className="text-[10px] text-dim">
        VTT oder SRT · max. 1 MB · SRT wird zu VTT konvertiert
      </p>
    </div>
  );
}
