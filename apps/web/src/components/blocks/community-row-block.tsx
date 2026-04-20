"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Icon } from "@/components/icon";
import { RichText } from "@/components/rich-text";

interface CommunityRowConfig {
  title?: string;
  badgeLabel?: string | null;
  limit?: number;
}

export function CommunityRowBlock({ config }: { config: CommunityRowConfig }) {
  const title = config.title ?? "Aus der Community";
  const badgeLabel = config.badgeLabel ?? "COMMUNITY";
  const limit = config.limit ?? 6;

  const { data, isPending } = trpc.community.recent.useQuery({ limit });
  const posts = data ?? [];

  return (
    <section className="my-12">
      <header className="mb-5 flex items-end justify-between">
        <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight">
          <Icon name="message" size={20} className="text-brand" />
          {title}
          {badgeLabel ? (
            <span className="mono rounded bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
              {badgeLabel}
            </span>
          ) : null}
        </h2>
      </header>
      {isPending ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <p className="text-muted">Noch keine Community-Posts.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <Link
                href={`/c/${p.channel.slug}#community`}
                className="flex items-center gap-2 text-xs text-muted transition hover:text-brand"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-[11px] font-bold text-neutral-900">
                  {p.channel.displayName[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="font-semibold text-foreground">
                  {p.channel.displayName}
                </span>
                <span className="mono text-dim">· {formatRelative(p.createdAt)}</span>
              </Link>
              <p className="line-clamp-5 whitespace-pre-wrap text-sm text-foreground">
                <RichText>{p.body}</RichText>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
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
