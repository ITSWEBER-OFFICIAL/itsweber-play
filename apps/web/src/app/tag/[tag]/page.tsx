"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video-card";

export default function TagPage() {
  const params = useParams<{ tag: string }>();
  const raw = decodeURIComponent(params.tag ?? "").toLowerCase();
  const result = trpc.search.byTag.useQuery({ tag: raw }, { enabled: raw.length > 0 });

  return (
    <main id="main" className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">
      <header className="mb-6">
        <p className="mono text-[11px] uppercase tracking-wider text-dim">Tag</p>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">#{raw}</h1>
      </header>

      {result.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : !result.data || result.data.videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-14 text-center">
          <p className="text-muted">
            Noch keine Videos mit dem Tag <span className="mono text-brand">#{raw}</span>.
          </p>
          <Link href="/" className="mt-4 inline-block text-brand hover:underline">
            ← Zur Startseite
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-6 gap-y-10">
          {result.data.videos.map((v) => (
            <li key={v.id}>
              <VideoCard video={v} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
