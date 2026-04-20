"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { Icon } from "@/components/icon";


export default function StudioSubscribersPage() {
  return (
    <StudioGate>
      <Subscribers />
    </StudioGate>
  );
}

function Subscribers() {
  const [cursor, setCursor] = useState<string | undefined>();
  const q = trpc.studio.subscribers.useQuery({ cursor, limit: 50 });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
          Abonnenten
        </h1>
        <p className="mt-1 text-sm text-muted">
          Wer folgt deinem Kanal und seit wann.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mono text-[11px] uppercase tracking-wider text-dim">
            Gesamt
          </div>
          <div className="mt-2 text-4xl font-extrabold tracking-tight">
            {q.data?.total ?? "…"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mono text-[11px] uppercase tracking-wider text-dim">
            Letzte 7 Tage
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight">
              {q.data?.last7d ?? "…"}
            </span>
            {q.data && q.data.last7d > 0 && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                +neu
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold">Liste</h2>

        {q.isPending ? (
          <p className="text-sm text-muted">Lädt …</p>
        ) : (q.data?.items ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
            <Icon name="users" size={28} className="mx-auto text-dim" />
            <p className="mt-3 text-muted">
              Noch keine Abonnent:innen — teile deinen Kanal.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {q.data!.items.map((s) => (
              <li
                key={`${s.handle}-${s.subscribedAt}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <Avatar url={s.avatarUrl} name={s.displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {s.displayName}
                    </span>
                    <span className="text-xs text-dim">@{s.handle}</span>
                  </div>
                  <div className="mono mt-0.5 text-[11px] text-muted">
                    seit{" "}
                    {new Date(s.subscribedAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                </div>
                {s.notify && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-1 text-[11px] font-medium text-brand">
                    <Icon name="bell" size={11} />
                    Notifs
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {q.data?.nextCursor && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setCursor(q.data!.nextCursor)}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:bg-surface-raised"
            >
              Weitere laden
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold text-neutral-900">
      {initial}
    </div>
  );
}
