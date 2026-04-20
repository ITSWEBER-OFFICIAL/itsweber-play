"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";
import { toast } from "@/lib/toast";
import {
  CATEGORY_ICONS,
  Icon,
  type IconName,
} from "@/components/icon";

export default function AdminCategoriesPage() {
  return (
    <AdminGate>
      <Categories />
    </AdminGate>
  );
}

function Categories() {
  const list = trpc.category.list.useQuery();
  const utils = trpc.useUtils();

  const invalidate = () => utils.category.list.invalidate();

  const create = trpc.category.create.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Kategorie angelegt");
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const update = trpc.category.update.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Kategorie aktualisiert");
    },
    onError: (err) => toast.error(err.message),
  });
  const del = trpc.category.delete.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Kategorie gelöscht");
    },
    onError: (err) => toast.error(err.message),
  });

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName | "">("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(100);

  function resetForm() {
    setSlug("");
    setName("");
    setIcon("");
    setDescription("");
    setOrder(100);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-extrabold tracking-tight">
          Kategorien
        </h1>
        <p className="mt-1 text-sm text-muted">
          Videos werden per Kategorie in Chips gefiltert. Drag-Reorder via
          Order-Feld (niedriger = weiter vorne).
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Neue Kategorie
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_140px_80px]">
          <Input
            label="Slug"
            value={slug}
            onChange={setSlug}
            placeholder="z.B. home-lab"
            mono
          />
          <Input
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Home-Lab"
          />
          <label className="block text-xs">
            <span className="mb-1 block text-muted">Icon</span>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface-raised text-brand">
                {icon ? <Icon name={icon} size={18} /> : null}
              </div>
              <select
                aria-label="Icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value as IconName | "")}
                className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">— kein Icon —</option>
                {CATEGORY_ICONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <Input
            label="Order"
            value={String(order)}
            onChange={(v) => setOrder(Math.max(0, Number(v) || 0))}
            placeholder="100"
          />
        </div>
        <div className="mt-3">
          <Input
            label="Beschreibung (optional)"
            value={description}
            onChange={setDescription}
            placeholder="Kurzbeschreibung für Kategorie-Seite."
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!slug || !name || create.isPending}
            onClick={() =>
              create.mutate({
                slug: slug.trim(),
                name: name.trim(),
                icon: icon.trim() || null,
                description: description.trim() || null,
                order,
              })
            }
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-50"
          >
            + Anlegen
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-md border border-border-strong bg-surface-raised px-4 py-2 text-sm font-medium text-muted hover:bg-surface-hover"
          >
            Zurücksetzen
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Bestehende ({list.data?.length ?? 0})
        </h2>
        {list.isPending ? (
          <p className="text-sm text-muted">Lädt …</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">Noch keine Kategorien.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.data!.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface-raised text-brand">
                  {c.icon ? (
                    <Icon name={c.icon as IconName} size={16} />
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">{c.name}</div>
                  <div className="mono text-[10px] text-dim">
                    {c.slug} · order {c.order} · {c._count.videos} Videos
                  </div>
                </div>
                <input
                  type="number"
                  aria-label={`Order für ${c.name}`}
                  className="mono w-16 rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
                  defaultValue={c.order}
                  onBlur={(e) => {
                    const newOrder = Number(e.target.value);
                    if (!Number.isFinite(newOrder) || newOrder === c.order) return;
                    update.mutate({ id: c.id, order: newOrder });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Kategorie „${c.name}" löschen? Videos verlieren nur die Zuordnung.`,
                      )
                    ) {
                      del.mutate({ id: c.id });
                    }
                  }}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:border-danger hover:text-danger"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          "w-full rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-brand " +
          (mono ? "mono" : "")
        }
      />
    </label>
  );
}
