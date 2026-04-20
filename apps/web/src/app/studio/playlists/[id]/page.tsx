"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { thumbnailUrl } from "@/lib/storage-urls";
import { formatDuration } from "@/components/video-card";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";

export default function StudioPlaylistEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <StudioGate>
      <PlaylistEditor playlistId={id} />
    </StudioGate>
  );
}

function PlaylistEditor({ playlistId }: { playlistId: string }) {
  const lists = trpc.playlist.mine.useQuery();
  const playlist = lists.data?.find((p) => p.id === playlistId);
  const detail = trpc.playlist.bySlug.useQuery(
    { slug: playlist?.slug ?? "" },
    { enabled: !!playlist?.slug },
  );
  const myVideos = trpc.video.mine.useQuery({ limit: 100 });

  const [addVideoId, setAddVideoId] = useState<string>("");
  const [items, setItems] = useState<
    { id: string; videoId: string; position: number }[]
  >([]);

  useEffect(() => {
    if (detail.data) {
      setItems(
        detail.data.items.map((i) => ({
          id: i.id,
          videoId: i.videoId,
          position: i.position,
        })),
      );
    }
  }, [detail.data?.id, detail.data?.items.length]);

  const addItem = trpc.playlist.addItem.useMutation({
    onSuccess: () => {
      toast.success("Video hinzugefügt.");
      detail.refetch();
      setAddVideoId("");
    },
    onError: (err) => toast.error(err.message),
  });
  const removeItem = trpc.playlist.removeItem.useMutation({
    onSuccess: () => {
      toast.success("Entfernt.");
      detail.refetch();
    },
  });
  const reorder = trpc.playlist.reorder.useMutation({
    onSuccess: () => toast.success("Reihenfolge gespeichert."),
  });

  function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setItems(next);
    reorder.mutate({
      playlistId,
      itemIds: next.map((i) => i.id),
    });
  }

  if (!playlist)
    return (
      <p className="text-sm text-muted">Playlist lädt oder nicht gefunden …</p>
    );

  const videosInList = new Set(items.map((i) => i.videoId));
  const selectableVideos = (myVideos.data ?? []).filter(
    (v) => v.status === "LIVE" && !videosInList.has(v.id),
  );

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/studio/playlists"
          className="mb-2 inline-flex items-center gap-1 text-xs text-dim hover:text-foreground"
        >
          <Icon name="chevron-left" size={12} />
          Zurück zu Playlists
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">
          {playlist.title}
        </h1>
        {playlist.description && (
          <p className="mt-1 text-sm text-muted">{playlist.description}</p>
        )}
        <div className="mono mt-2 flex items-center gap-2 text-[11px] text-muted">
          <span>{items.length} Videos</span>
          <span className="text-dim">·</span>
          <span>{playlist.visibility}</span>
          <span className="text-dim">·</span>
          <Link
            href={`/playlist/${playlist.slug}`}
            target="_blank"
            className="text-brand hover:underline"
          >
            öffentlich →
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-bold">Video hinzufügen</h2>
        <div className="flex gap-2">
          <select
            value={addVideoId}
            onChange={(e) => setAddVideoId(e.target.value)}
            title="Video wählen"
            aria-label="Video wählen"
            className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="">— wähle ein LIVE-Video —</option>
            {selectableVideos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!addVideoId || addItem.isPending}
            onClick={() =>
              addItem.mutate({ playlistId, videoId: addVideoId })
            }
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand/90 disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold">Reihenfolge</h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
            <p className="text-sm text-muted">Noch keine Videos.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, idx) => {
              const v = detail.data?.items.find((i) => i.id === item.id)?.video;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
                >
                  <span className="mono w-6 text-center text-xs text-dim">
                    {idx + 1}
                  </span>
                  {v?.thumbnailKey && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbnailUrl(v.thumbnailKey)}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium">
                      {v?.title ?? "—"}
                    </span>
                    <span className="mono text-[10px] text-dim">
                      {formatDuration(v?.durationSec ?? null) ?? ""}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Nach oben"
                      className="rounded border border-border p-1 text-dim transition hover:bg-surface-raised disabled:opacity-30"
                    >
                      <Icon name="chevron-up" size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === items.length - 1}
                      aria-label="Nach unten"
                      className="rounded border border-border p-1 text-dim transition hover:bg-surface-raised disabled:opacity-30"
                    >
                      <Icon name="chevron-down" size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        removeItem.mutate({ itemId: item.id })
                      }
                      aria-label="Entfernen"
                      className="rounded border border-border p-1 text-dim transition hover:border-danger hover:text-danger"
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
