"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { videoHlsUrl, thumbnailUrl } from "@/lib/storage-urls";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";

export default function TrimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <StudioGate>
      <TrimEditor id={id} />
    </StudioGate>
  );
}

function TrimEditor({ id }: { id: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const video = trpc.video.getForEdit.useQuery({ id });
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  const duration = video.data?.durationSec ?? 0;

  useEffect(() => {
    if (video.data) {
      setEnd(video.data.durationSec ?? 0);
    }
  }, [video.data?.durationSec]);

  // HLS-Setup
  useEffect(() => {
    if (!video.data) return;
    const el = videoRef.current;
    if (!el) return;
    const src = videoHlsUrl(video.data.id);
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      return;
    }
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(el);
      hlsRef.current = hls;
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }
    el.src = src;
  }, [video.data?.id]);

  // Vorschau-Stopper: wenn Preview aktiv und currentTime >= end, pausieren.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      if (previewing && el.currentTime >= end) {
        el.pause();
        setPreviewing(false);
      }
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [end, previewing]);

  const trimMut = trpc.video.trim.useMutation({
    onSuccess: () => {
      toast.success("Trim gestartet — Worker transcodiert neu.");
      router.push(`/studio/${id}/edit`);
    },
    onError: (err) => toast.error(err.message),
  });

  function setInPoint() {
    setStart(Math.min(currentTime, end - 0.1));
  }
  function setOutPoint() {
    setEnd(Math.max(currentTime, start + 0.1));
  }
  function preview() {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = start;
    el.play().catch(() => undefined);
    setPreviewing(true);
  }
  function submit() {
    if (!confirm(
      "Original wird überschrieben und neu transcodiert. Fortfahren?",
    )) {
      return;
    }
    trimMut.mutate({ videoId: id, startSec: start, endSec: end });
  }

  if (video.isPending) return <p className="text-sm text-muted">Lädt …</p>;
  if (video.error)
    return <p className="text-sm text-danger">{video.error.message}</p>;
  if (!video.data) return null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/studio/${id}/edit`}
            className="mb-2 inline-flex items-center gap-1 text-xs text-dim hover:text-foreground"
          >
            <Icon name="chevron-left" size={12} />
            Zurück zur Bearbeitung
          </Link>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">
            Trimmen
          </h1>
          <p className="mt-1 text-sm text-muted line-clamp-1">
            {video.data.title}
          </p>
        </div>
        <div className="mono text-right text-[11px] text-muted">
          <div>
            Dauer: <span className="text-foreground">{fmt(duration)}</span>
          </div>
          <div>
            Neu:{" "}
            <span className="text-brand">
              {fmt(Math.max(0, end - start))}
            </span>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          controls
          poster={
            video.data.thumbnailKey
              ? thumbnailUrl(video.data.thumbnailKey)
              : undefined
          }
          className="aspect-video w-full"
        >
          <track kind="captions" src="" srcLang="de" label="Deutsch" />
        </video>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mono mb-4 flex items-center justify-between text-xs">
          <div className="text-dim">
            Aktuell: <span className="text-foreground">{fmt(currentTime)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={setInPoint}
              className="rounded-md border border-border bg-surface-raised px-3 py-1.5 font-medium transition hover:bg-surface"
            >
              ⊢ In-Punkt
            </button>
            <button
              type="button"
              onClick={setOutPoint}
              className="rounded-md border border-border bg-surface-raised px-3 py-1.5 font-medium transition hover:bg-surface"
            >
              Out-Punkt ⊣
            </button>
            <button
              type="button"
              onClick={preview}
              className="rounded-md border border-brand bg-brand/10 px-3 py-1.5 font-medium text-brand transition hover:bg-brand/20"
            >
              ▶ Vorschau
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <SliderRow
            id="start-slider"
            label="Start"
            value={start}
            max={duration}
            onChange={(v) => setStart(Math.min(v, end - 0.1))}
          />
          <SliderRow
            id="end-slider"
            label="Ende"
            value={end}
            max={duration}
            onChange={(v) => setEnd(Math.max(v, start + 0.1))}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={trimMut.isPending || end <= start}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="scissors" size={14} />
            {trimMut.isPending ? "Wird verarbeitet …" : "Trimmen & neu transcodieren"}
          </button>
          <p className="text-xs text-muted">
            Das Original wird überschrieben. Für präzise Schnitte lokal
            schneiden und neu hochladen.
          </p>
        </div>
      </section>
    </div>
  );
}

function SliderRow({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="mono text-dim">{fmt(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        title={label}
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-raised accent-brand"
      />
    </div>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}
