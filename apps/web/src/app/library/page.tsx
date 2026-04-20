"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video-card";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

export default function LibraryPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <main className="p-10 text-muted">Lädt …</main>;
  }
  if (!session) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Bibliothek</h1>
        <p className="text-muted">
          <Link href="/login" className="text-brand hover:underline">
            Anmelden
          </Link>
          , um deine Bibliothek zu öffnen.
        </p>
      </main>
    );
  }
  return <Library />;
}

// Typ für Video-Kachel in allen Sections
type VideoItem = {
  id: string;
  slug: string;
  title: string;
  thumbnailKey: string | null;
  durationSec: number | null;
  viewCount?: number;
  publishedAt: string | Date | null;
  channel?: { slug: string; displayName: string };
};

function Library() {
  const utils = trpc.useUtils();

  const fromSubs = trpc.subscription.latestVideos.useQuery({ limit: 8 });
  const mine = trpc.video.mine.useQuery({ limit: 8 });
  const history = trpc.history.list.useQuery({ limit: 12 });
  const watchLater = trpc.watchLater.list.useQuery({ limit: 12 });

  const clearHistory = trpc.history.clear.useMutation({
    onSuccess: () => {
      toast.success("Verlauf gelöscht");
      utils.history.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const historyItems: VideoItem[] =
    (history.data?.items ?? []).map((r) => r.video as VideoItem);
  const watchLaterItems: VideoItem[] =
    (watchLater.data?.items ?? []).map((r) => r.video as VideoItem);

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
          Bibliothek
        </h1>
        <p className="mt-1 text-sm text-muted">
          Deine Sammlung — Abos, Verlauf und Merkliste.
        </p>
      </header>

      <div className="space-y-12">
        {/* Zuletzt angesehen (History) */}
        <section>
          <header className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold">Zuletzt angesehen</h2>
            <div className="flex items-center gap-3">
              {historyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearHistory.mutate()}
                  disabled={clearHistory.isPending}
                  className="flex items-center gap-1.5 text-xs text-muted transition hover:text-danger disabled:opacity-50"
                >
                  <Icon name="trash" size={13} />
                  Verlauf löschen
                </button>
              )}
              <Link href="#" className="text-sm text-brand hover:underline">
                Alle →
              </Link>
            </div>
          </header>
          {history.isPending ? (
            <p className="text-xs text-muted">Lädt …</p>
          ) : historyItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center">
              <p className="text-xs text-muted">
                Noch kein Verlauf. Sieh dir ein Video an und es erscheint hier.
              </p>
            </div>
          ) : (
            <VideoGrid videos={historyItems} />
          )}
        </section>

        {/* Später ansehen (Watch-Later) */}
        <section>
          <header className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold">Später ansehen</h2>
            <Link href="#" className="text-sm text-brand hover:underline">
              Alle →
            </Link>
          </header>
          {watchLater.isPending ? (
            <p className="text-xs text-muted">Lädt …</p>
          ) : watchLaterItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center">
              <p className="text-xs text-muted">
                Keine gespeicherten Videos. Klicke das{" "}
                <Icon
                  name="bookmark"
                  size={12}
                  className="inline text-muted"
                />{" "}
                -Symbol auf einer Watch-Seite.
              </p>
            </div>
          ) : (
            <VideoGrid videos={watchLaterItems} />
          )}
        </section>

        {/* Zuletzt aus deinen Abos */}
        <LibrarySection
          title="Zuletzt aus deinen Abos"
          empty="Keine Abos. Öffne /channels und folge Creator."
          href="/subs"
          videos={(fromSubs.data ?? []) as VideoItem[]}
          loading={fromSubs.isPending}
        />

        {/* Deine Uploads */}
        <LibrarySection
          title="Deine Uploads"
          empty="Noch nichts hochgeladen."
          href="/studio/videos"
          videos={(mine.data ?? []) as VideoItem[]}
          loading={mine.isPending}
        />
      </div>
    </main>
  );
}

function VideoGrid({ videos }: { videos: VideoItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((v) => (
        <li key={v.id}>
          <VideoCard
            video={{
              id: v.id,
              slug: v.slug,
              title: v.title,
              thumbnailKey: v.thumbnailKey,
              durationSec: v.durationSec,
              viewCount: v.viewCount ?? 0,
              publishedAt: v.publishedAt,
              channel: v.channel ?? { slug: "mine", displayName: "Dein Kanal" },
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function LibrarySection({
  title,
  empty,
  href,
  videos,
  loading,
}: {
  title: string;
  empty: string;
  href: string;
  videos: VideoItem[];
  loading: boolean;
}) {
  return (
    <section>
      <header className="mb-4 flex items-end justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href={href} className="text-sm text-brand hover:underline">
          Alle →
        </Link>
      </header>
      {loading ? (
        <p className="text-xs text-muted">Lädt …</p>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center">
          <p className="text-xs text-muted">{empty}</p>
        </div>
      ) : (
        <VideoGrid videos={videos} />
      )}
    </section>
  );
}
