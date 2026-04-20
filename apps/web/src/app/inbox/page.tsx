"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const params = useSearchParams();
  const initialPeer = params.get("to");
  const { data: session, isPending } = useSession();
  const user = session?.user as { id?: string } | undefined;

  const [peerId, setPeerId] = useState<string | null>(initialPeer);
  const threads = trpc.dm.listThreads.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const messages = trpc.dm.listMessages.useQuery(
    { peerId: peerId ?? "", limit: 80 },
    { enabled: !!user && !!peerId, refetchInterval: peerId ? 15_000 : false },
  );
  const utils = trpc.useUtils();
  const send = trpc.dm.sendMessage.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.dm.listMessages.invalidate({ peerId: peerId ?? "", limit: 80 });
      utils.dm.listThreads.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const markRead = trpc.dm.markRead.useMutation({
    onSuccess: () => {
      utils.dm.unreadCount.invalidate();
      utils.dm.listThreads.invalidate();
    },
  });

  useEffect(() => {
    if (peerId) markRead.mutate({ peerId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  const [draft, setDraft] = useState("");

  const selectedThread = useMemo(() => {
    return (threads.data ?? []).find((t) => t.peerId === peerId) ?? null;
  }, [threads.data, peerId]);

  if (!isPending && !user) {
    return (
      <main id="main" className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Nachrichten</h1>
        <p className="mt-2 text-muted">Bitte anmelden, um deine Inbox zu sehen.</p>
        <Link
          href="/login?next=/inbox"
          className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Anmelden
        </Link>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto flex h-[calc(100vh-64px)] max-w-[1280px] gap-0 px-2 py-2 sm:px-4 sm:py-4 md:gap-4 md:px-6">
      <aside
        className={
          "shrink-0 flex-col rounded-xl border border-border bg-surface md:flex md:w-80 " +
          (peerId ? "hidden w-full" : "flex w-full")
        }
      >
        <header className="border-b border-border px-4 py-3">
          <h1 className="text-lg font-bold">Nachrichten</h1>
        </header>
        <ul className="flex-1 overflow-y-auto">
          {threads.isPending ? (
            <li className="p-4 text-xs text-muted">Lädt …</li>
          ) : (threads.data ?? []).length === 0 ? (
            <li className="p-4 text-xs text-dim">Noch keine Unterhaltungen.</li>
          ) : (
            (threads.data ?? []).map((t) => (
              <li key={t.peerId}>
                <button
                  type="button"
                  onClick={() => setPeerId(t.peerId)}
                  className={`flex w-full items-start gap-2 border-b border-border px-3 py-3 text-left transition hover:bg-surface-raised ${
                    peerId === t.peerId ? "bg-brand/10" : ""
                  }`}
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-xs font-bold text-neutral-900">
                    {t.peer?.handle[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {t.peer?.displayName ?? "Unbekannt"}
                      </span>
                      {t.unread > 0 && (
                        <span className="mono grid h-4 min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-neutral-900">
                          {t.unread > 99 ? "99+" : t.unread}
                        </span>
                      )}
                    </div>
                    <p className="mono truncate text-[11px] text-dim">
                      @{t.peer?.handle ?? "?"}
                    </p>
                    <p className="line-clamp-1 text-xs text-muted">{t.lastBody}</p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section
        className={
          "min-w-0 flex-1 flex-col rounded-xl border border-border bg-surface md:flex " +
          (peerId ? "flex" : "hidden md:flex")
        }
      >
        {!peerId ? (
          <div className="grid flex-1 place-items-center text-sm text-muted">
            Wähle links eine Unterhaltung.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
              <button
                type="button"
                onClick={() => setPeerId(null)}
                aria-label="Zurück zur Liste"
                className="rounded-md p-1 text-muted hover:bg-surface-raised hover:text-foreground md:hidden"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-xs font-bold text-neutral-900">
                {selectedThread?.peer?.handle[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {selectedThread?.peer?.displayName ?? "Unbekannt"}
                </p>
                <p className="mono truncate text-[11px] text-dim">
                  @{selectedThread?.peer?.handle ?? "?"}
                </p>
              </div>
            </header>
            <ul className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
              {messages.isPending ? (
                <li className="text-xs text-muted">Lädt …</li>
              ) : (messages.data ?? []).length === 0 ? (
                <li className="text-xs text-dim">Noch keine Nachrichten.</li>
              ) : (
                (messages.data ?? []).map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <li
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-brand/20 text-foreground"
                            : "bg-surface-raised text-foreground"
                        }`}
                      >
                        {m.body}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim() || !peerId) return;
                send.mutate({ recipientId: peerId, body: draft.trim() });
              }}
              className="flex items-end gap-2 border-t border-border p-3"
            >
              <textarea
                aria-label="Nachricht schreiben"
                rows={2}
                maxLength={4000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Schreib eine Nachricht …"
                className="min-w-0 flex-1 resize-none rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus-visible:border-brand"
              />
              <button
                type="submit"
                disabled={!draft.trim() || send.isPending}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60"
              >
                {send.isPending ? "…" : "Senden"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
