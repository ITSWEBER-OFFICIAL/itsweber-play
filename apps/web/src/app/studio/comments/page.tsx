"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { toast } from "@/lib/toast";

export default function StudioCommentsPage() {
  return (
    <StudioGate>
      <CommentsFeed />
    </StudioGate>
  );
}

function CommentsFeed() {
  const feed = trpc.comment.mineFeed.useQuery({ limit: 100 });
  const utils = trpc.useUtils();
  const del = trpc.comment.delete.useMutation({
    onSuccess: () => {
      utils.comment.mineFeed.invalidate();
      toast.success("Kommentar gelöscht");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-extrabold tracking-tight">
          Kommentare
        </h1>
        <p className="mt-1 text-sm text-muted">
          Alle Kommentare zu deinen Videos — chronologisch absteigend.
        </p>
      </header>

      {feed.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : (feed.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <p className="text-muted">Noch keine Kommentare.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {feed.data!.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">
                  {c.user.displayName}
                </span>
                <span className="mono text-dim">@{c.user.handle}</span>
                <span className="text-dim">·</span>
                <Link
                  href={`/watch/${c.video.slug}`}
                  className="truncate text-brand hover:underline"
                >
                  {c.video.title}
                </Link>
                <span className="mono text-[10px] text-dim">
                  {new Date(c.createdAt).toLocaleString("de-DE")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {c.body}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/watch/${c.video.slug}#c-${c.id}`}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted hover:border-border-strong hover:text-foreground"
                >
                  Öffnen
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Kommentar löschen?")) {
                      del.mutate({ id: c.id });
                    }
                  }}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted hover:border-danger hover:text-danger"
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
