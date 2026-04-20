"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video-card";

export default function SearchPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-[1440px] px-6 py-10">Lädt …</main>}
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const q = (params?.get("q") ?? "").trim();
  const categorySlug = params?.get("cat") ?? undefined;

  const result = trpc.search.all.useQuery(
    { q, categorySlug, limit: 32 },
    { enabled: q.length > 0 },
  );

  return (
    <main id="main" className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">
      <header className="mb-8">
        <p className="mono text-[11px] uppercase tracking-wider text-dim">
          Suche
        </p>
        <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.02em]">
          {q ? (
            <>
              „<span className="text-brand">{q}</span>"
            </>
          ) : (
            "Was suchst du?"
          )}
        </h1>
        {categorySlug && (
          <p className="mono mt-1 text-xs text-muted">
            in Kategorie: {categorySlug}
          </p>
        )}
      </header>

      {!q ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <p className="text-muted">
            Nutze die Suche im Header, um Videos, Kanäle und Tags zu finden.
          </p>
        </div>
      ) : result.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : result.error ? (
        <p className="text-danger">{result.error.message}</p>
      ) : (
        <div className="space-y-10">
          {/* Channels */}
          {result.data.channels.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                Kanäle ({result.data.channels.length})
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.data.channels.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/c/${c.slug}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-brand/40"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-bold text-neutral-900">
                        {c.displayName[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {c.displayName}
                        </div>
                        <div className="mono text-[10px] text-dim">
                          @{c.slug} · {c._count.videos} Videos ·{" "}
                          {c._count.subscriptions} Abos
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tags */}
          {result.data.tags.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Tags
              </h2>
              <ul className="flex flex-wrap gap-2">
                {result.data.tags.map((t) => (
                  <li key={t.tag}>
                    <Link
                      href={`/search?q=${encodeURIComponent(t.tag)}`}
                      className="mono rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition hover:border-brand hover:text-brand"
                    >
                      #{t.tag}
                      <span className="ml-1.5 text-[10px] text-dim">
                        {t.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(() => {
            const longs = result.data.videos.filter((v) => v.format !== "SHORT");
            const shorts = result.data.videos.filter((v) => v.format === "SHORT");
            return (
              <>
                {/* Videos (Long-Form) */}
                <section>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                    Videos ({longs.length})
                  </h2>
                  {longs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
                      <p className="text-muted">
                        Keine PUBLIC-Videos mit diesem Suchbegriff.
                      </p>
                    </div>
                  ) : (
                    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {longs.map((v) => (
                        <li key={v.id}>
                          <VideoCard video={v} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Shorts */}
                {shorts.length > 0 && (
                  <section>
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
                      Shorts ({shorts.length})
                      <span className="mono rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                        SHORTS
                      </span>
                    </h2>
                    <ul className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {shorts.map((v) => (
                        <li key={v.id} className="w-[180px] shrink-0">
                          <Link
                            href={`/shorts?v=${v.slug}`}
                            className="group block overflow-hidden rounded-xl bg-black"
                          >
                            <div className="relative aspect-[9/16] w-full bg-surface-raised">
                              {v.thumbnailKey && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={`${process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? ""}/play-thumbs/${v.thumbnailKey}`}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              )}
                              <p className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/85 to-transparent p-2 text-[12px] font-bold text-white">
                                {v.title}
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            );
          })()}
        </div>
      )}
    </main>
  );
}
