"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video-card";

export default function SubsPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <main className="p-10 text-muted">Lädt …</main>;
  }
  if (!session) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Abos</h1>
        <p className="text-muted">
          <Link href="/login" className="text-brand hover:underline">
            Anmelden
          </Link>
          , um deinen Abo-Feed zu sehen.
        </p>
      </main>
    );
  }
  return <SubsFeed />;
}

function SubsFeed() {
  const subs = trpc.subscription.list.useQuery();
  const latest = trpc.subscription.latestVideos.useQuery({ limit: 30, format: "LONG" });
  const shorts = trpc.subscription.latestVideos.useQuery({ limit: 12, format: "SHORT" });

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Abos</h1>
        <p className="mt-1 text-sm text-muted">
          Neueste Videos aus Kanälen, denen du folgst.
        </p>
      </header>

      {/* Abonnierte Kanäle — horizontal */}
      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Deine Abos
        </h2>
        {subs.isPending ? (
          <p className="text-xs text-muted">Lädt …</p>
        ) : (subs.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8">
            <p className="text-muted">
              Noch keine Abos. Öffne{" "}
              <Link href="/channels" className="text-brand hover:underline">
                das Kanal-Directory
              </Link>{" "}
              und folge ein paar Creator.
            </p>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {subs.data!.map((s) => (
              <li key={s.channelId}>
                <Link
                  href={`/c/${s.channel.slug}`}
                  className="flex items-center gap-3 rounded-full border border-border bg-surface px-3 py-1.5 transition hover:border-brand/40 hover:bg-surface-raised"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-neutral-900">
                    {s.channel.displayName[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {s.channel.displayName}
                  </span>
                  <span className="mono text-[10px] text-dim">
                    {s.channel._count.videos} Videos
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Neueste Videos (LONG) */}
      <section className="mb-12">
        <h2 className="mb-5 text-lg font-bold">Neue Videos</h2>
        {latest.isPending ? (
          <p className="text-muted">Lädt …</p>
        ) : (latest.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
            <p className="text-muted">
              {subs.data?.length === 0
                ? "Kein Abo → keine Videos. Beginne mit dem Kanal-Directory."
                : "Deine Kanäle haben noch keine PUBLIC-Videos."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {latest.data!.map((v) => (
              <li key={v.id}>
                <VideoCard video={v} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Neueste Shorts */}
      {(shorts.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
            Neue Shorts
            <span className="mono rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">
              SHORTS
            </span>
          </h2>
          <ul className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shorts.data!.map((v) => (
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
    </main>
  );
}
