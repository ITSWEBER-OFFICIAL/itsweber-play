"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Icon } from "@/components/icon";

// Kleiner Header-Icon-Link zum DM-Inbox. Badge zeigt ungelesene DM-Anzahl.
// Nutzt tRPC dm.unreadCount mit 30-s-Polling.

export function InboxBell() {
  const unread = trpc.dm.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const count = unread.data ?? 0;

  return (
    <Link
      href="/inbox"
      aria-label={`Nachrichten (${count} ungelesen)`}
      className="relative grid h-9 w-9 place-items-center rounded-md border border-border-strong text-muted transition hover:bg-surface hover:text-foreground"
    >
      <Icon name="mail" size={16} />
      {count > 0 && (
        <span className="mono absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-neutral-900">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
