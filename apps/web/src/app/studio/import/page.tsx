"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StudioGate } from "@/components/studio-gate";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { FormatToggle } from "@/components/format-toggle";
import { SourceToggle } from "@/components/source-toggle";

export default function ImportPage() {
  return (
    <StudioGate>
      <Suspense fallback={null}>
        <ImportForm />
      </Suspense>
    </StudioGate>
  );
}

function ImportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isShort = searchParams.get("format") === "short";
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const importMutation = trpc.video.import.useMutation({
    onSuccess: (result) => {
      toast.success("Import gestartet — Transcoding läuft");
      router.push(`/studio/${result.videoId}/edit`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    importMutation.mutate({
      url: url.trim(),
      title: title.trim() || undefined,
      format: isShort ? "SHORT" : "LONG",
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-3">
        <p className="mono text-xs uppercase tracking-[0.15em] text-brand">
          yt-dlp Import
        </p>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
          {isShort ? "Short importieren" : "Video aus YouTube/Vimeo/… importieren"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <FormatToggle active={isShort ? "short" : "video"} />
          <SourceToggle active="import" />
        </div>
        <p className="text-sm text-muted">
          {isShort
            ? "Hochformat-Video bis 60 s importieren — der Worker klassifiziert automatisch als Short basierend auf Aspect-Ratio + Dauer."
            : "Das Video wird via yt-dlp geladen, lokal transkodiert und landet als Kopie in deinem MinIO — es streamt danach unabhängig vom Original."}
        </p>
      </header>

      {/* Urheberrechts-Banner — explizit statt implizit */}
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-semibold text-warning">⚠ Rechtlicher Hinweis</p>
        <p className="mt-1 text-muted">
          Du bist verantwortlich für die Rechte an importierten Inhalten. Das
          Video wird automatisch als <span className="mono text-brand">PRIVATE</span>{" "}
          angelegt — erst nach dem Freischalten im Studio sichtbar für andere.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted">
            Video-URL
          </span>
          <input
            type="url"
            required
            autoFocus
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-brand"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted">
            Titel (optional — sonst aus Metadaten)
          </span>
          <input
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand"
          />
        </label>

        {error && (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!url || importMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60 [box-shadow:var(--shadow-glow)]"
          >
            {importMutation.isPending ? "Import läuft …" : "Importieren"}
          </button>
        </div>
      </form>
    </div>
  );
}
