"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Icon, type IconName } from "@/components/icon";

interface ChipsConfig {
  // Legacy (strings) — falls Block-Config noch Old-Format hat, rendern wir
  // die einfach als statische Labels.
  items?: string[];
}

// Rendert die Kategorien aus der DB (sortiert nach `order`). Die `items`-Prop
// aus dem Block-Config wird nur noch als Fallback benutzt, wenn das Datenbank-
// System ganz leer ist — normalerweise führt jeder Chip auf `/category/<slug>`.

export function CategoryChipsBlock({ config }: { config: ChipsConfig }) {
  const categories = trpc.category.list.useQuery();

  const hasDbCategories =
    categories.data && categories.data.length > 0;

  const chips = hasDbCategories
    ? categories.data!.map((c) => ({
        key: c.slug,
        label: c.name,
        icon: (c.icon as IconName | null) ?? null,
        href: `/category/${c.slug}`,
      }))
    : (config.items ?? []).map((i) => ({
        key: i,
        label: i,
        icon: null as IconName | null,
        href: null,
      }));

  if (chips.length === 0) return null;

  return (
    <div className="chips-scroll flex gap-2 overflow-x-auto py-2">
      <Link
        href="/"
        className="whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Alle
      </Link>
      {chips.map((c) =>
        c.href ? (
          <Link
            key={c.key}
            href={c.href}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:border-border-strong hover:bg-surface-raised hover:text-foreground"
          >
            {c.icon && <Icon name={c.icon} size={14} />}
            {c.label}
          </Link>
        ) : (
          <span
            key={c.key}
            className="whitespace-nowrap rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted"
          >
            {c.label}
          </span>
        ),
      )}
    </div>
  );
}
