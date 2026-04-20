"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import {
  BLOCK_LABELS,
  type PageBlockData,
  type PageBlockType,
} from "@/components/blocks/types";

const PAGE_SLUG = "home";

const ADDABLE_BLOCKS: { type: PageBlockType; hint: string }[] = [
  { type: "HERO", hint: "Großes Feature-Video oben" },
  { type: "VIDEO_GRID", hint: "Raster-Liste aus Videos (Long oder Short)" },
  { type: "SHORTS_ROW", hint: "Horizontal scrollendes 9:16-Karussell" },
  { type: "CHANNEL_ROW", hint: "Empfohlene Kanäle (Discovery)" },
  { type: "COMMUNITY_ROW", hint: "Letzte Community-Posts" },
  { type: "CATEGORY_CHIPS", hint: "Filter-Leiste" },
  { type: "CTA_BANNER", hint: "Call-to-Action mit Button" },
];

// ─── Page ───────────────────────────────────────────────────────────────

export default function AdminPageBlocksPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const sessionUser = session?.user as
    | { id: string; role?: string }
    | undefined;
  const isAdmin = sessionUser?.role === "ADMIN";

  const utils = trpc.useUtils();
  const list = trpc.page.list.useQuery(
    { pageSlug: PAGE_SLUG, includeDisabled: true },
    { enabled: isAdmin },
  );

  const invalidate = () => {
    utils.page.list.invalidate();
  };

  const create = trpc.page.create.useMutation({ onSuccess: invalidate });
  const update = trpc.page.update.useMutation({ onSuccess: invalidate });
  const del = trpc.page.delete.useMutation({ onSuccess: invalidate });
  const reorder = trpc.page.reorder.useMutation({ onSuccess: invalidate });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Keep an optimistic ordered view of block ids so drag-reorder feels
  // instant — we persist after drop and rely on invalidate() for reconcile.
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    if (!list.data) return;
    setOrderedIds(list.data.map((b) => b.id));
  }, [list.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const blocksById = useMemo(() => {
    const map = new Map<string, PageBlockData>();
    for (const b of list.data ?? []) map.set(b.id, b as PageBlockData);
    return map;
  }, [list.data]);

  const selectedBlock = selectedId ? blocksById.get(selectedId) : null;

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    reorder.mutate({ pageSlug: PAGE_SLUG, ids: next });
  }

  // ─── Gates ────────────────────────────────────────────────────────────
  if (sessionPending) return <p className="text-muted">Lädt …</p>;
  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Page-Blöcke</h1>
        <Link href="/login" className="text-brand hover:underline">
          Anmelden
        </Link>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Kein Zugriff</h1>
        <p className="text-muted">Nur für Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-extrabold tracking-tight">
          Startseite · Blöcke
        </h1>
        <p className="mt-1 text-sm text-muted">
          Drag zum Umsortieren, klick zum Bearbeiten. Änderungen landen live
          in der Preview rechts (SSE).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr_360px]">
        {/* ─── LEFT: Block-Liste + Adder ─────────────────── */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Layout
            </h3>
            <div className="p-3">
              {list.isPending && (
                <p className="text-xs text-muted">Lädt …</p>
              )}
              {!list.isPending && orderedIds.length === 0 && (
                <p className="text-xs text-dim">
                  Noch keine Blöcke. Frontend zeigt aktuell das Default-Layout.
                </p>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={orderedIds}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1.5">
                    {orderedIds.map((id) => {
                      const block = blocksById.get(id);
                      if (!block) return null;
                      return (
                        <SortableBlockItem
                          key={id}
                          id={id}
                          block={block}
                          selected={selectedId === id}
                          onSelect={() => setSelectedId(id)}
                          onToggle={() =>
                            update.mutate({
                              id,
                              enabled: !block.enabled,
                            })
                          }
                          onDelete={() => {
                            if (
                              window.confirm(
                                `Block „${BLOCK_LABELS[block.type]}" löschen?`,
                              )
                            ) {
                              if (selectedId === id) setSelectedId(null);
                              del.mutate({ id });
                            }
                          }}
                        />
                      );
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Block hinzufügen
            </h3>
            <div className="space-y-1 p-3">
              {ADDABLE_BLOCKS.map((b) => (
                <button
                  key={b.type}
                  type="button"
                  onClick={() =>
                    create.mutate(
                      { pageSlug: PAGE_SLUG, type: b.type },
                      {
                        onSuccess: (row) => setSelectedId(row.id),
                      },
                    )
                  }
                  disabled={create.isPending}
                  className="flex w-full items-start gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-left text-xs transition hover:border-brand hover:bg-surface-hover disabled:opacity-50"
                >
                  <span className="mono mt-0.5 text-brand">+</span>
                  <span className="flex-1">
                    <span className="block font-medium text-foreground">
                      {BLOCK_LABELS[b.type]}
                    </span>
                    <span className="block text-dim">{b.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        {/* ─── CENTER: Live-Preview ──────────────────────── */}
        <section className="min-h-[70vh] overflow-hidden rounded-2xl border border-border-strong bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-muted">
              Live-Preview (Startseite)
            </span>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand hover:underline"
            >
              Neuer Tab →
            </a>
          </div>
          <iframe
            src="/"
            title="Preview Startseite"
            className="h-[min(72vh,900px)] w-full border-0 bg-background"
          />
        </section>

        {/* ─── RIGHT: Config-Editor ──────────────────────── */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Konfiguration
            </h3>
            {selectedBlock ? (
              <BlockConfigEditor
                key={selectedBlock.id}
                block={selectedBlock}
                onSave={(config) =>
                  update.mutate({ id: selectedBlock.id, config })
                }
              />
            ) : (
              <p className="p-3 text-xs text-dim">
                Block links wählen, um Config zu bearbeiten.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// ─── Sortable item ──────────────────────────────────────────────────────

function SortableBlockItem({
  id,
  block,
  selected,
  onSelect,
  onToggle,
  onDelete,
}: {
  id: string;
  block: { type: PageBlockType; enabled: boolean; config: Record<string, unknown> };
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const title = BLOCK_LABELS[block.type];
  const subtitle = summarizeConfig(block.type, block.config);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition " +
        (selected
          ? "border-brand bg-brand/10"
          : "border-border bg-surface-raised hover:border-border-strong")
      }
    >
      <button
        type="button"
        aria-label="Umsortieren (ziehen)"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-dim hover:text-foreground active:cursor-grabbing"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-foreground">
            {title}
          </span>
          {!block.enabled && (
            <span className="mono rounded bg-border px-1 py-0.5 text-[9px] text-dim">
              AUS
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-dim">{subtitle}</div>
      </button>
      <button
        type="button"
        onClick={onToggle}
        title={block.enabled ? "Block ausblenden" : "Block einblenden"}
        className="rounded p-1 text-dim hover:text-foreground"
      >
        {block.enabled ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C6 19 2 12 2 12a21 21 0 0 1 5.06-5.94M9.9 4.24A10.5 10.5 0 0 1 12 4c6 0 10 7 10 7a21 21 0 0 1-3.06 4.06M1 1l22 22" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Block löschen"
        className="rounded p-1 text-dim hover:text-danger"
      >
        ×
      </button>
    </li>
  );
}

function summarizeConfig(
  type: PageBlockType,
  config: Record<string, unknown>,
): string {
  switch (type) {
    case "HERO":
      return (config.videoSlug as string) || "Auto: neuestes Video";
    case "VIDEO_GRID":
      return `${config.title ?? "Neueste Videos"} · ${(config.format as string) ?? "LONG"} · ${config.orderBy ?? "latest"} · ${config.limit ?? 12}`;
    case "CATEGORY_CHIPS":
      return `${(config.items as string[])?.length ?? 0} Einträge`;
    case "CTA_BANNER":
      return String(config.headline ?? "");
    case "SHORTS_ROW":
      return `${config.title ?? "Neueste Shorts"} · ${config.orderBy ?? "latest"} · ${config.limit ?? 10}`;
    case "CHANNEL_ROW":
      return `${config.title ?? "Empfohlene Kanäle"} · ${config.orderBy ?? "mostSubscribed"} · ${config.limit ?? 8}`;
    case "COMMUNITY_ROW":
      return `${config.title ?? "Aus der Community"} · ${config.limit ?? 6}`;
  }
}

// ─── Config editor (per type) ───────────────────────────────────────────

function BlockConfigEditor({
  block,
  onSave,
}: {
  block: {
    id: string;
    type: PageBlockType;
    config: Record<string, unknown>;
  };
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(block.config);

  const setField = (k: string, v: unknown) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const commit = () => onSave(draft);

  return (
    <div className="space-y-3 p-3">
      {block.type === "HERO" && (
        <>
          <HeroVideoPicker
            value={(draft.videoSlug as string | null | undefined) ?? null}
            onChange={(slug) => {
              setField("videoSlug", slug);
              setTimeout(commit, 0);
            }}
          />
          <Field label="Badge-Label">
            <input
              type="text"
              value={String(draft.badgeLabel ?? "")}
              onChange={(e) => setField("badgeLabel", e.target.value)}
              onBlur={commit}
              placeholder="Featured"
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="CTA-Label">
            <input
              type="text"
              value={String(draft.ctaLabel ?? "")}
              onChange={(e) => setField("ctaLabel", e.target.value)}
              onBlur={commit}
              placeholder="Jetzt ansehen"
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
        </>
      )}

      {block.type === "VIDEO_GRID" && (
        <>
          <Field label="Titel">
            <input
              type="text"
              aria-label="Grid-Titel"
              value={String(draft.title ?? "")}
              onChange={(e) => setField("title", e.target.value)}
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Badge-Label (leer = kein Badge)">
            <input
              type="text"
              aria-label="Badge-Label"
              value={String(draft.badgeLabel ?? "")}
              onChange={(e) =>
                setField("badgeLabel", e.target.value || null)
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Format">
            <select
              aria-label="Video-Format"
              value={String(draft.format ?? "LONG")}
              onChange={(e) => {
                setField("format", e.target.value);
                setTimeout(commit, 0);
              }}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            >
              <option value="LONG">Nur Videos (Long-Form)</option>
              <option value="SHORT">Nur Shorts</option>
              <option value="ALL">Beide (gemischt)</option>
            </select>
          </Field>
          <Field label="Sortierung">
            <select
              aria-label="Sortierung"
              value={String(draft.orderBy ?? "latest")}
              onChange={(e) => {
                setField("orderBy", e.target.value);
                setTimeout(commit, 0);
              }}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            >
              <option value="latest">Neueste zuerst</option>
              <option value="mostViewed">Meistgesehen</option>
            </select>
          </Field>
          <Field label="Max. Anzahl">
            <input
              type="number"
              aria-label="Max. Anzahl Videos"
              min={1}
              max={48}
              value={Number(draft.limit ?? 12)}
              onChange={(e) =>
                setField("limit", Math.max(1, Number(e.target.value) || 12))
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Featured-Video überspringen">
            <input
              type="checkbox"
              aria-label="Featured-Video überspringen"
              checked={draft.skipFeatured !== false}
              onChange={(e) => {
                setField("skipFeatured", e.target.checked);
                setTimeout(commit, 0);
              }}
              className="h-4 w-4 rounded border border-border"
            />
          </Field>
        </>
      )}

      {block.type === "SHORTS_ROW" && (
        <>
          <Field label="Titel">
            <input
              type="text"
              aria-label="Shorts-Row-Titel"
              value={String(draft.title ?? "")}
              onChange={(e) => setField("title", e.target.value)}
              onBlur={commit}
              placeholder="Neueste Shorts"
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Badge-Label (leer = kein Badge)">
            <input
              type="text"
              aria-label="Shorts-Badge-Label"
              value={String(draft.badgeLabel ?? "")}
              onChange={(e) =>
                setField("badgeLabel", e.target.value || null)
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Sortierung">
            <select
              aria-label="Shorts-Sortierung"
              value={String(draft.orderBy ?? "latest")}
              onChange={(e) => {
                setField("orderBy", e.target.value);
                setTimeout(commit, 0);
              }}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            >
              <option value="latest">Neueste zuerst</option>
              <option value="mostViewed">Meistgesehen</option>
            </select>
          </Field>
          <Field label="Max. Anzahl">
            <input
              type="number"
              aria-label="Max. Anzahl Shorts"
              min={1}
              max={24}
              value={Number(draft.limit ?? 10)}
              onChange={(e) =>
                setField("limit", Math.max(1, Number(e.target.value) || 10))
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
        </>
      )}

      {block.type === "CHANNEL_ROW" && (
        <>
          <Field label="Titel">
            <input
              type="text"
              aria-label="Channel-Row-Titel"
              value={String(draft.title ?? "")}
              onChange={(e) => setField("title", e.target.value)}
              onBlur={commit}
              placeholder="Empfohlene Kanäle"
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Badge-Label (leer = kein Badge)">
            <input
              type="text"
              aria-label="Channel-Badge-Label"
              value={String(draft.badgeLabel ?? "")}
              onChange={(e) =>
                setField("badgeLabel", e.target.value || null)
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Sortierung">
            <select
              aria-label="Channel-Sortierung"
              value={String(draft.orderBy ?? "mostSubscribed")}
              onChange={(e) => {
                setField("orderBy", e.target.value);
                setTimeout(commit, 0);
              }}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            >
              <option value="mostSubscribed">Meiste Abos</option>
              <option value="mostVideos">Meiste Videos</option>
              <option value="newest">Neueste</option>
            </select>
          </Field>
          <Field label="Max. Anzahl">
            <input
              type="number"
              aria-label="Max. Anzahl Kanäle"
              min={1}
              max={20}
              value={Number(draft.limit ?? 8)}
              onChange={(e) =>
                setField("limit", Math.max(1, Number(e.target.value) || 8))
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
        </>
      )}

      {block.type === "COMMUNITY_ROW" && (
        <>
          <Field label="Titel">
            <input
              type="text"
              aria-label="Community-Row-Titel"
              value={String(draft.title ?? "")}
              onChange={(e) => setField("title", e.target.value)}
              onBlur={commit}
              placeholder="Aus der Community"
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Badge-Label (leer = kein Badge)">
            <input
              type="text"
              aria-label="Community-Badge-Label"
              value={String(draft.badgeLabel ?? "")}
              onChange={(e) =>
                setField("badgeLabel", e.target.value || null)
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Max. Anzahl">
            <input
              type="number"
              aria-label="Max. Anzahl Posts"
              min={1}
              max={12}
              value={Number(draft.limit ?? 6)}
              onChange={(e) =>
                setField("limit", Math.max(1, Number(e.target.value) || 6))
              }
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
        </>
      )}

      {block.type === "CATEGORY_CHIPS" && (
        <Field label="Einträge (eine pro Zeile)">
          <textarea
            aria-label="Kategorien-Einträge"
            value={(draft.items as string[] | undefined)?.join("\n") ?? ""}
            onChange={(e) =>
              setField(
                "items",
                e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            onBlur={commit}
            rows={8}
            className="mono w-full rounded border border-border bg-surface-raised p-2 text-xs text-foreground"
          />
        </Field>
      )}

      {block.type === "CTA_BANNER" && (
        <>
          <Field label="Headline">
            <input
              type="text"
              aria-label="CTA-Headline"
              value={String(draft.headline ?? "")}
              onChange={(e) => setField("headline", e.target.value)}
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Body-Text">
            <textarea
              aria-label="CTA-Body"
              value={String(draft.body ?? "")}
              onChange={(e) => setField("body", e.target.value)}
              onBlur={commit}
              rows={3}
              className="w-full rounded border border-border bg-surface-raised p-2 text-xs text-foreground"
            />
          </Field>
          <Field label="Button-Label">
            <input
              type="text"
              aria-label="CTA-Button-Label"
              value={String(draft.ctaLabel ?? "")}
              onChange={(e) => setField("ctaLabel", e.target.value)}
              onBlur={commit}
              className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
          <Field label="Button-Ziel (URL)">
            <input
              type="text"
              value={String(draft.ctaHref ?? "")}
              onChange={(e) => setField("ctaHref", e.target.value)}
              onBlur={commit}
              placeholder="/studio/upload"
              className="mono w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
            />
          </Field>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}

// Admin-only Picker für das Featured-Video im Hero-Block. Dropdown zeigt
// PUBLIC+LIVE Long-Form-Videos aus dem Katalog — „Auto"-Option lässt
// BlockRenderer das neueste picken.
function HeroVideoPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const videos = trpc.video.list.useQuery({ limit: 48, format: "LONG" });
  return (
    <Field label="Featured Video">
      <select
        aria-label="Featured Video auswählen"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="mono w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
      >
        <option value="">— Automatisch (neuestes)</option>
        {videos.data?.map((v) => (
          <option key={v.id} value={v.slug}>
            {v.title} · @{v.channel.slug}
          </option>
        ))}
      </select>
      <p className="mono mt-1 text-[10px] text-dim">
        Nur PUBLIC + LIVE Long-Form-Videos. Shorts haben einen eigenen Feed.
      </p>
    </Field>
  );
}
