"use client";

import { Suspense, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StudioGate } from "@/components/studio-gate";
import { API_URL } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { FormatToggle } from "@/components/format-toggle";
import { SourceToggle } from "@/components/source-toggle";
import { InfoTooltip } from "@/components/info-tooltip";

// XHR statt fetch, weil fetch uns keinen Upload-Progress gibt.
// tus.io kommt in v0.2 für resumable uploads.
function uploadWithProgress(
  file: File,
  title: string,
  format: "LONG" | "SHORT",
  onProgress: (pct: number) => void,
): Promise<{ videoId: string; slug: string; status: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/upload`, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.setRequestHeader("X-Upload-Title", encodeURIComponent(title));
    xhr.setRequestHeader("X-Upload-Format", format === "SHORT" ? "short" : "long");

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error("Antwort ist kein JSON"));
        }
      } else {
        reject(
          new Error(
            `Upload fehlgeschlagen (${xhr.status}): ${xhr.responseText || xhr.statusText}`,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Netzwerk-Fehler beim Upload"));
    xhr.send(file);
  });
}

export default function UploadPage() {
  return (
    <StudioGate>
      <Suspense fallback={null}>
        <UploadForm />
      </Suspense>
    </StudioGate>
  );
}

function UploadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isShort = searchParams.get("format") === "short";
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadWithProgress(
        file,
        title,
        isShort ? "SHORT" : "LONG",
        setProgress,
      );
      toast.success("Upload komplett — Transcoding läuft");
      router.push(`/studio/${result.videoId}/edit`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">
          {isShort ? "Short hochladen" : "Video hochladen"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <FormatToggle active={isShort ? "short" : "video"} />
          <InfoTooltip
            content="Video = Querformat, beliebige Länge. Short = Hochformat, ≤ 60 s. Der Worker erkennt das Format auch automatisch anhand der Aspect-Ratio."
            helpHref="/help#format"
          />
          <SourceToggle active="upload" />
          <InfoTooltip
            content="Upload lädt eine lokale Datei hoch. Import holt ein Video direkt per URL (YouTube, Vimeo, etc.) über yt-dlp."
            helpHref="/help#import"
          />
        </div>
        <p className="text-sm text-muted">
          {isShort
            ? "Hochformat-Video bis 60 s — der Worker klassifiziert automatisch als Short basierend auf Aspect-Ratio + Dauer."
            : "Nach dem Upload transkodiert der Worker zu HLS. Default-Sichtbarkeit ist PRIVATE — im Editor umschalten, wenn das Video fertig ist."}
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted">
            Titel
          </span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-brand"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted">
            Video-Datei
          </span>
          <input
            type="file"
            accept="video/*"
            required
            onChange={onFileChange}
            disabled={isUploading}
            className="w-full cursor-pointer rounded-md border border-dashed border-border bg-surface px-3 py-6 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:font-medium file:text-neutral-900 hover:border-brand"
          />
        </label>

        {isUploading && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full bg-brand transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted">Upload: {progress}%</p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={!file || isUploading}
          className="w-full rounded-md bg-brand px-4 py-2 font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60"
        >
          {isUploading ? `Upload läuft … ${progress}%` : "Hochladen"}
        </button>
      </form>
    </div>
  );
}
