"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Icon } from "@/components/icon";

// In-Header-Dropdown mit Badge für unread-Count + Liste der letzten 20.
// Öffnet bei Klick, schließt bei Click-Outside oder Esc.

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const list = trpc.notification.list.useQuery(
    { limit: 20 },
    { enabled: open },
  );
  const utils = trpc.useUtils();
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });
  const markOne = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const count = unread.data ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Benachrichtigungen (${count} ungelesen)`}
        className="relative grid h-9 w-9 place-items-center rounded-md border border-border-strong text-muted transition hover:bg-surface hover:text-foreground"
      >
        <Icon name="bell" size={16} />
        {count > 0 && (
          <span className="mono absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-neutral-900">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-card)]">
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Benachrichtigungen</span>
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={count === 0 || markAllRead.isPending}
              className="text-xs text-brand hover:underline disabled:opacity-40"
            >
              Alle gelesen
            </button>
          </header>

          <ul className="max-h-[400px] overflow-y-auto">
            {list.isPending ? (
              <li className="p-4 text-xs text-muted">Lädt …</li>
            ) : (list.data ?? []).length === 0 ? (
              <li className="p-4 text-xs text-dim">Noch keine Events.</li>
            ) : (
              list.data!.map((n) => {
                const isUnread = !n.readAt;
                const content = (
                  <>
                    <div className="flex items-start gap-2">
                      {isUnread && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted">
                            {n.body}
                          </div>
                        )}
                        <div className="mono mt-1 text-[10px] text-dim">
                          {new Date(n.createdAt).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                );
                return (
                  <li
                    key={n.id}
                    className={
                      "border-b border-border last:border-b-0 " +
                      (isUnread ? "bg-brand/5" : "")
                    }
                  >
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (isUnread) markOne.mutate({ id: n.id });
                          setOpen(false);
                        }}
                        className="block p-3 transition hover:bg-surface-raised"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isUnread) markOne.mutate({ id: n.id });
                        }}
                        className="block w-full p-3 text-left transition hover:bg-surface-raised"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
