"use client";

import Link from "next/link";
import { StudioGate } from "@/components/studio-gate";
import { Icon } from "@/components/icon";

const TILES = [
  {
    href: "/studio/upload",
    icon: "upload" as const,
    title: "Video hochladen",
    body: "Datei hochladen · MP4/MOV/MKV · max. 8 GB",
  },
  {
    href: "/studio/import",
    icon: "link" as const,
    title: "Video importieren",
    body: "Per URL via yt-dlp · YouTube/Vimeo/…",
  },
  {
    href: "/studio/upload?format=short",
    icon: "bolt" as const,
    title: "Short hochladen",
    body: "Hochformat · ≤ 60 s",
  },
  {
    href: "/studio/import?format=short",
    icon: "link" as const,
    title: "Short importieren",
    body: "Hochformat · ≤ 60 s",
  },
] as const;

export default function StudioNewPage() {
  return (
    <StudioGate>
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-12">
        <header className="space-y-1">
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">
            Erstellen
          </h1>
          <p className="text-muted">Was möchtest du veröffentlichen?</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TILES.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand/20">
                <Icon name={tile.icon} size={24} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{tile.title}</p>
                <p className="mt-1 text-[13px] leading-snug text-dim">
                  {tile.body}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </StudioGate>
  );
}
