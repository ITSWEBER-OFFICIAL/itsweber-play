"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video-card";
import { Icon, type IconName } from "@/components/icon";

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const result = trpc.category.getBySlug.useQuery({ slug });

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">
      {result.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : result.error ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-14 text-center">
          <h1 className="text-2xl font-bold">Kategorie nicht gefunden</h1>
          <p className="mt-2 text-muted">
            Die Kategorie <span className="mono text-brand">{slug}</span>{" "}
            existiert nicht mehr.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-brand hover:underline"
          >
            ← Zurück
          </Link>
        </div>
      ) : (
        <>
          <header className="mb-8 flex items-start gap-4">
            {result.data.category.icon && (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-brand">
                <Icon
                  name={result.data.category.icon as IconName}
                  size={28}
                  strokeWidth={1.75}
                />
              </div>
            )}
            <div>
              <p className="mono text-[11px] uppercase tracking-wider text-dim">
                Kategorie
              </p>
              <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
                {result.data.category.name}
              </h1>
              {result.data.category.description && (
                <p className="mt-1 max-w-2xl text-sm text-muted">
                  {result.data.category.description}
                </p>
              )}
            </div>
          </header>

          {result.data.videos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 p-14 text-center">
              <p className="text-muted">
                In dieser Kategorie gibt es noch keine Videos.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {result.data.videos.map((v) => (
                <li key={v.id}>
                  <VideoCard video={v} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
