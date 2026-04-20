"use client";

// Community-Tab auf der Channel-Seite. Listet alle Posts des Kanals, erlaubt
// Polls zu voten und — falls Owner/Admin — einen neuen Post zu erstellen.

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { MentionTextarea } from "@/components/mention-textarea";
import { RichText } from "@/components/rich-text";

interface Props {
  slug: string;
}

export function CommunityTab({ slug }: Props) {
  const { data: session } = useSession();
  const channelQuery = trpc.channel.getBySlug.useQuery({ slug });
  const list = trpc.community.list.useQuery(
    { channelSlug: slug, limit: 40 },
  );
  const utils = trpc.useUtils();

  const channelId = channelQuery.data?.channel.id ?? "";
  const ownerId = (channelQuery.data?.channel as { ownerId?: string } | undefined)?.ownerId;
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  const canPost =
    !!sessionUser &&
    (sessionUser.id === ownerId || sessionUser.role === "ADMIN");

  const [draft, setDraft] = useState("");
  const [pollDraft, setPollDraft] = useState<string[]>([]);
  const [pollMode, setPollMode] = useState(false);

  const create = trpc.community.create.useMutation({
    onSuccess: () => {
      utils.community.list.invalidate({ channelSlug: slug });
      setDraft("");
      setPollDraft([]);
      setPollMode(false);
      toast.success("Post veröffentlicht");
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.community.delete.useMutation({
    onSuccess: () => {
      utils.community.list.invalidate({ channelSlug: slug });
      toast.success("Post gelöscht");
    },
    onError: (e) => toast.error(e.message),
  });
  const vote = trpc.community.vote.useMutation({
    onSuccess: () => utils.community.list.invalidate({ channelSlug: slug }),
    onError: (e) => toast.error(e.message),
  });

  const posts = list.data ?? [];

  return (
    <div className="space-y-6">
      {canPost && channelId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            const polls = pollMode
              ? pollDraft
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((label) => ({ label }))
              : undefined;
            create.mutate({
              channelId,
              body: draft.trim(),
              pollOptions: polls && polls.length >= 2 ? polls : undefined,
            });
          }}
          className="rounded-xl border border-border bg-surface p-4"
        >
          <MentionTextarea
            aria-label="Community-Post schreiben"
            value={draft}
            onChange={setDraft}
            rows={3}
            maxLength={2000}
            placeholder="Teile ein Update … (@user oder #tag)"
            className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus-visible:border-brand"
          />
          {pollMode && (
            <div className="mt-3 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  type="text"
                  aria-label={`Poll-Option ${i + 1}`}
                  value={pollDraft[i] ?? ""}
                  onChange={(e) => {
                    const next = [...pollDraft];
                    next[i] = e.target.value;
                    setPollDraft(next);
                  }}
                  placeholder={i < 2 ? `Option ${i + 1} (Pflicht)` : `Option ${i + 1} (optional)`}
                  className="w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs text-foreground outline-none focus-visible:border-brand"
                />
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPollMode((m) => !m)}
                className={`rounded-md border border-border bg-surface-raised px-3 py-1 text-xs transition hover:border-brand ${pollMode ? "text-brand" : "text-muted"}`}
              >
                {pollMode ? "Poll entfernen" : "Umfrage"}
              </button>
              <span className="mono text-[10px] text-dim">{draft.length}/2000</span>
            </div>
            <button
              type="submit"
              disabled={!draft.trim() || create.isPending}
              className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60"
            >
              {create.isPending ? "Postet …" : "Veröffentlichen"}
            </button>
          </div>
        </form>
      )}

      {list.isPending ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Community-Posts.</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => {
            const canDelete =
              sessionUser &&
              (sessionUser.id === p.author.id ||
                sessionUser.id === ownerId ||
                sessionUser.role === "ADMIN");
            return (
              <li
                key={p.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-[11px] font-bold text-neutral-900">
                    {p.author.handle[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="font-semibold text-foreground">{p.author.displayName}</span>
                  <span className="mono text-dim">@{p.author.handle}</span>
                  <span className="mono text-dim">· {formatRelative(p.createdAt)}</span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Post löschen?")) del.mutate({ id: p.id });
                      }}
                      className="ml-auto text-[11px] text-muted transition hover:text-danger"
                    >
                      Löschen
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  <RichText>{p.body}</RichText>
                </p>
                {p.poll && (
                  <div className="mt-3 space-y-1.5" role="group" aria-label="Umfrage">
                    {p.poll.options.map((opt, idx) => {
                      const total = p.poll!.totalVotes;
                      const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                      const mine = p.poll!.myVote === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!sessionUser || vote.isPending}
                          onClick={() => vote.mutate({ postId: p.id, optionIdx: idx })}
                          className={`relative w-full overflow-hidden rounded-md border px-3 py-1.5 text-left text-xs transition ${
                            mine
                              ? "border-brand bg-brand/15 text-foreground"
                              : "border-border bg-surface-raised text-muted hover:border-brand/60"
                          }`}
                        >
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 bg-brand/10"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative flex justify-between">
                            <span>{opt.label}</span>
                            <span className="mono text-dim">
                              {opt.votes} · {pct}%
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    <p className="mono text-[10px] text-dim">
                      {p.poll.totalVotes} Stimmen
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} T`;
  return new Date(iso).toLocaleDateString("de-DE");
}
