"use client";

// Minimal-Profil-Seite (@mention-Landing). Bei nur einem Kanal: Redirect auf
// den Kanal. Sonst Liste. Zusätzlich DM-Link, falls der Empfänger offen ist.

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";

interface Params {
  handle: string;
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = use(params);
  const search = trpc.user.search.useQuery({ q: handle, limit: 1 });
  const user = search.data?.find(
    (u) => u.handle.toLowerCase() === handle.toLowerCase(),
  );
  const session = useSession();

  if (search.isPending) {
    return (
      <main id="main" className="mx-auto max-w-xl px-6 py-16">
        <p className="text-muted">Lädt …</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main id="main" className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Nutzer nicht gefunden</h1>
        <p className="text-muted">
          Es gibt niemanden mit dem Handle{" "}
          <span className="mono text-brand">@{handle}</span>.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Zurück
        </Link>
      </main>
    );
  }

  const myId = (session.data?.user as { id?: string } | undefined)?.id;
  const isMe = myId === user.id;

  return (
    <main id="main" className="mx-auto max-w-xl space-y-6 px-6 py-16">
      <header className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-2xl font-bold text-neutral-900">
          {user.handle[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.displayName}</h1>
          <p className="mono text-sm text-dim">@{user.handle}</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/c/${user.handle}`}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:border-border-strong hover:text-foreground"
        >
          Kanal ansehen
        </Link>
        {!isMe && myId && (
          <Link
            href={`/inbox?to=${user.id}`}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-brand-hover"
          >
            Nachricht senden
          </Link>
        )}
      </div>
    </main>
  );
}
