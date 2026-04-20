"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";
import { RichText } from "@/components/rich-text";
import { MentionTextarea } from "@/components/mention-textarea";

interface CommentRow {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  pinnedAt: string | null;
  heartedByCreator: boolean;
  user: {
    id: string;
    handle: string;
    displayName: string;
    role: string;
  };
}

export function CommentsSection({
  videoId,
  videoOwnerId,
  commentsEnabled,
}: {
  videoId: string;
  videoOwnerId: string;
  commentsEnabled: boolean;
}) {
  const { data: session } = useSession();
  const user = session?.user as { id?: string; role?: string } | undefined;

  const list = trpc.comment.list.useQuery({ videoId, limit: 200 });
  const utils = trpc.useUtils();

  const [body, setBody] = useState("");
  const create = trpc.comment.create.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ videoId });
      setBody("");
      toast.success("Kommentar gepostet");
    },
    onError: (err) => toast.error(err.message),
  });
  const del = trpc.comment.delete.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ videoId });
      toast.success("Kommentar gelöscht");
    },
    onError: (err) => toast.error(err.message),
  });
  const pin = trpc.comment.pin.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ videoId });
      toast.success("Kommentar aktualisiert");
    },
    onError: (err) => toast.error(err.message),
  });
  const heart = trpc.comment.heart.useMutation({
    onSuccess: () => utils.comment.list.invalidate({ videoId }),
    onError: (err) => toast.error(err.message),
  });

  const grouped = useMemo(() => {
    const all = (list.data ?? []) as CommentRow[];
    const tops: CommentRow[] = [];
    const children = new Map<string, CommentRow[]>();
    for (const c of all) {
      if (!c.parentId) tops.push(c);
      else {
        const arr = children.get(c.parentId) ?? [];
        arr.push(c);
        children.set(c.parentId, arr);
      }
    }
    for (const arr of children.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return { tops, children };
  }, [list.data]);

  if (!commentsEnabled) {
    return (
      <section className="mt-8 rounded-lg border border-border bg-surface p-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Icon name="alert-circle" size={14} />
          Kommentare sind für dieses Video deaktiviert.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8" aria-live="polite">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon name="message" size={18} />
          {(list.data ?? []).length} Kommentare
        </h2>
      </header>

      {user ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            create.mutate({ videoId, body: body.trim() });
          }}
          className="mb-6 flex gap-3"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-neutral-900">
            {(user as { handle?: string }).handle?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <MentionTextarea
              aria-label="Kommentar schreiben"
              value={body}
              onChange={setBody}
              maxLength={4000}
              rows={2}
              placeholder="Schreib einen Kommentar … (@user oder #tag)"
              className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus-visible:border-brand"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="mono text-[10px] text-dim">
                {body.length}/4000
              </span>
              <button
                type="submit"
                disabled={!body.trim() || create.isPending}
                className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60"
              >
                {create.isPending ? "Postet …" : "Kommentieren"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 rounded-lg border border-border bg-surface-raised p-3 text-sm text-muted">
          <Link href="/login" className="text-brand hover:underline">
            Anmelden
          </Link>
          , um zu kommentieren.
        </div>
      )}

      {list.isPending ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : grouped.tops.length === 0 ? (
        <p className="text-sm text-muted">
          Noch keine Kommentare — sei die erste Person.
        </p>
      ) : (
        <ul className="space-y-6">
          {grouped.tops.map((c) => (
            <CommentRowView
              key={c.id}
              comment={c}
              replies={grouped.children.get(c.id) ?? []}
              videoId={videoId}
              videoOwnerId={videoOwnerId}
              currentUserId={user?.id ?? null}
              currentUserRole={user?.role ?? null}
              onDelete={(id) => del.mutate({ id })}
              onPin={(id, pinned) => pin.mutate({ id, pinned })}
              onHeart={(id, hearted) => heart.mutate({ id, hearted })}
              onReply={(parentId, text) =>
                create.mutate({ videoId, body: text, parentId })
              }
              creating={create.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentRowView({
  comment,
  replies,
  videoId: _videoId,
  videoOwnerId,
  currentUserId,
  currentUserRole,
  onDelete,
  onPin,
  onHeart,
  onReply,
  creating,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  videoId: string;
  videoOwnerId: string;
  currentUserId: string | null;
  currentUserRole: string | null;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onHeart: (id: string, hearted: boolean) => void;
  onReply: (parentId: string, body: string) => void;
  creating: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const canDelete =
    currentUserId &&
    (currentUserId === comment.user.id ||
      currentUserId === videoOwnerId ||
      currentUserRole === "ADMIN");
  const canModerate =
    currentUserId &&
    (currentUserId === videoOwnerId || currentUserRole === "ADMIN");
  const isCreator = comment.user.id === videoOwnerId;
  const isAdmin = comment.user.role === "ADMIN";
  const isPinned = Boolean(comment.pinnedAt);
  const isHearted = comment.heartedByCreator;

  return (
    <li id={`c-${comment.id}`}>
      <div className="flex gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-neutral-900">
          {comment.user.handle[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isPinned && (
              <span
                className="mono inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand"
                title="Gepinnt vom Creator"
              >
                📌 Gepinnt
              </span>
            )}
            <span className="font-semibold text-foreground">
              {comment.user.displayName}
            </span>
            <span className="mono text-dim">@{comment.user.handle}</span>
            {isCreator && (
              <span className="mono rounded-full bg-brand/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand">
                Creator
              </span>
            )}
            {!isCreator && isAdmin && (
              <span className="mono rounded-full bg-surface-raised px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                Team
              </span>
            )}
            <span className="mono text-dim">
              {formatRelative(comment.createdAt)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            <RichText>{comment.body}</RichText>
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted">
            {currentUserId && (
              <button
                type="button"
                onClick={() => setReplyOpen((o) => !o)}
                className="transition hover:text-brand"
              >
                Antworten
              </button>
            )}
            {canModerate && (
              <>
                <button
                  type="button"
                  onClick={() => onPin(comment.id, !isPinned)}
                  className={`transition hover:text-brand ${isPinned ? "text-brand" : ""}`}
                  aria-pressed={isPinned}
                >
                  {isPinned ? "Pin entfernen" : "Pinnen"}
                </button>
                <button
                  type="button"
                  onClick={() => onHeart(comment.id, !isHearted)}
                  className={`transition hover:text-rose-400 ${isHearted ? "text-rose-400" : ""}`}
                  aria-pressed={isHearted}
                  aria-label={isHearted ? "Herz entfernen" : "Herz vergeben"}
                >
                  {isHearted ? "❤ Geherzt" : "♡ Herzen"}
                </button>
              </>
            )}
            {isHearted && !canModerate && (
              <span
                className="inline-flex items-center gap-1 text-rose-400"
                title="Vom Creator geherzt"
              >
                ❤
              </span>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Kommentar löschen?")) {
                    onDelete(comment.id);
                  }
                }}
                className="transition hover:text-danger"
              >
                Löschen
              </button>
            )}
          </div>

          {replyOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!replyText.trim()) return;
                onReply(comment.id, replyText.trim());
                setReplyText("");
                setReplyOpen(false);
              }}
              className="mt-3"
            >
              <MentionTextarea
                aria-label={`Antwort auf ${comment.user.handle}`}
                value={replyText}
                onChange={setReplyText}
                rows={2}
                maxLength={4000}
                placeholder={`Antwort an @${comment.user.handle} …`}
                className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus-visible:border-brand"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyText("");
                  }}
                  className="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-muted hover:border-border-strong"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={!replyText.trim() || creating}
                  className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-neutral-900 disabled:opacity-60"
                >
                  Antworten
                </button>
              </div>
            </form>
          )}

          {replies.length > 0 && (
            <ul className="mt-4 space-y-4 border-l border-border pl-4">
              {replies.map((r) => (
                <CommentRowView
                  key={r.id}
                  comment={r}
                  replies={[]}
                  videoId={_videoId}
                  videoOwnerId={videoOwnerId}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onDelete={onDelete}
                  onPin={onPin}
                  onHeart={onHeart}
                  onReply={onReply}
                  creating={creating}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
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
