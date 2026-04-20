"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE" | "LOGGED_IN";

export default function StudioPlaylistsPage() {
  return (
    <StudioGate>
      <Playlists />
    </StudioGate>
  );
}

function Playlists() {
  const lists = trpc.playlist.mine.useQuery();
  const channel = trpc.channel.myChannel.useQuery();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");

  const create = trpc.playlist.create.useMutation({
    onSuccess: () => {
      toast.success("Playlist angelegt.");
      setCreating(false);
      setTitle("");
      setDescription("");
      lists.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const del = trpc.playlist.delete.useMutation({
    onSuccess: () => {
      toast.success("Playlist gelöscht.");
      lists.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
            Playlists
          </h1>
          <p className="mt-1 text-sm text-muted">
            Gruppiere Videos nach Thema, Serie oder Serie.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand/90"
        >
          <Icon name="plus" size={14} />
          Neue Playlist
        </button>
      </header>

      {creating && channel.data && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              channelId: channel.data!.id,
              title: title.trim(),
              description: description.trim() || undefined,
              visibility,
            });
          }}
          className="space-y-4 rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="text-sm font-bold">Neue Playlist</h2>
          <div>
            <label
              htmlFor="pl-title"
              className="mb-1 block text-xs font-medium"
            >
              Titel
            </label>
            <input
              id="pl-title"
              type="text"
              title="Titel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={1}
              maxLength={120}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="pl-desc"
              className="mb-1 block text-xs font-medium"
            >
              Beschreibung
            </label>
            <textarea
              id="pl-desc"
              title="Beschreibung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="pl-vis"
              className="mb-1 block text-xs font-medium"
            >
              Sichtbarkeit
            </label>
            <select
              id="pl-vis"
              title="Sichtbarkeit"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="PUBLIC">Public</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="LOGGED_IN">Login-Pflicht</option>
              <option value="PRIVATE">Privat</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand/90 disabled:opacity-50"
            >
              {create.isPending ? "…" : "Anlegen"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {lists.isPending ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : (lists.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <Icon name="list" size={28} className="mx-auto text-dim" />
          <p className="mt-3 text-muted">Noch keine Playlists.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {lists.data!.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/studio/playlists/${p.id}`}
                  className="text-sm font-semibold hover:text-brand"
                >
                  {p.title}
                </Link>
                <div className="mono mt-1 flex items-center gap-2 text-[11px] text-muted">
                  <span>{p._count.items} Videos</span>
                  <span className="text-dim">·</span>
                  <span>{p.visibility}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Playlist „${p.title}" löschen?`)) {
                    del.mutate({ id: p.id });
                  }
                }}
                aria-label="Löschen"
                className="text-dim transition hover:text-danger"
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
