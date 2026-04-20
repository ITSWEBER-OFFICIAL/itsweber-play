"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";

type ListItem = {
  slug: string;
  title: string;
  published: boolean;
  showInFooter: boolean;
  order: number;
  updatedAt: string;
  updatedBy: string | null;
};

export default function AdminPagesPage() {
  return (
    <AdminGate>
      <PagesAdmin />
    </AdminGate>
  );
}

function PagesAdmin() {
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [creating, setCreating] = useState(false);

  const pages = trpc.staticPage.list.useQuery();
  const utils = trpc.useUtils();

  const upsert = trpc.staticPage.upsert.useMutation({
    onSuccess: (_d, vars) => {
      utils.staticPage.list.invalidate();
      toast.success(`Seite „${vars.title}" gespeichert.`);
      setEditing(null);
      setCreating(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const del = trpc.staticPage.delete.useMutation({
    onSuccess: (_d, vars) => {
      utils.staticPage.list.invalidate();
      toast.success(`Seite „${vars.slug}" gelöscht.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const openEdit = (item: ListItem) => {
    setCreating(false);
    setEditing(item);
  };
  const openCreate = () => {
    setEditing(null);
    setCreating(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">
            Statische Seiten
          </h1>
          <p className="mt-1 text-sm text-muted">
            Impressum · Datenschutz · AGB und weitere CMS-Seiten.
            Nur Admins können diese bearbeiten.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
        >
          <Icon name="plus" size={16} />
          Neue Seite
        </button>
      </header>

      {pages.isPending && <p className="text-muted">Lädt …</p>}
      {pages.error && (
        <p className="text-danger">Fehler: {pages.error.message}</p>
      )}

      {pages.data && pages.data.length > 0 && (
        <>
          {/* Desktop: Tabelle */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-background/40">
                <tr className="text-left">
                  <Th>Slug / URL</Th>
                  <Th>Titel</Th>
                  <Th>Status</Th>
                  <Th>Footer</Th>
                  <Th>Order</Th>
                  <Th>Zuletzt geändert</Th>
                  <Th>
                    <span className="sr-only">Aktionen</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pages.data.map((p) => (
                  <tr
                    key={p.slug}
                    className="border-t border-border hover:bg-surface-hover"
                  >
                    <Td>
                      <code className="mono text-[12px] text-brand">
                        /{p.slug}
                      </code>
                    </Td>
                    <Td>{p.title}</Td>
                    <Td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          p.published
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning"
                        }`}
                      >
                        {p.published ? "Veröffentlicht" : "Entwurf"}
                      </span>
                    </Td>
                    <Td>{p.showInFooter ? "✓" : "—"}</Td>
                    <Td>{p.order}</Td>
                    <Td>
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(p.updatedAt))}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded px-2 py-1 text-xs font-medium text-muted hover:text-foreground"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `Seite „${p.slug}" wirklich löschen? Diese Aktion ist nicht rückgängig zu machen.`,
                              )
                            ) {
                              del.mutate({ slug: p.slug });
                            }
                          }}
                          className="rounded px-2 py-1 text-xs font-medium text-danger hover:opacity-80"
                        >
                          Löschen
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Stack-Cards */}
          <ul className="space-y-3 md:hidden">
            {pages.data.map((p) => (
              <li
                key={p.slug}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="mono min-w-0 truncate text-[12px] text-brand">
                    /{p.slug}
                  </code>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      p.published
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {p.published ? "Veröffentlicht" : "Entwurf"}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {p.title}
                </div>
                <div className="mono mt-1 text-[11px] text-dim">
                  Footer: {p.showInFooter ? "✓" : "—"} · Order: {p.order} ·{" "}
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                  }).format(new Date(p.updatedAt))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand hover:text-brand"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Seite „${p.slug}" wirklich löschen? Diese Aktion ist nicht rückgängig zu machen.`,
                        )
                      ) {
                        del.mutate({ slug: p.slug });
                      }
                    }}
                    className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-danger transition hover:border-danger"
                  >
                    Löschen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {pages.data?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted">
          Noch keine Seiten angelegt.
        </div>
      )}

      {(editing || creating) && (
        <EditModal
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(data) => upsert.mutate(data)}
          saving={upsert.isPending}
        />
      )}
    </div>
  );
}

// ─── Edit / Create Modal ─────────────────────────────────────────────────────

interface EditModalProps {
  initial: ListItem | null;
  onClose: () => void;
  onSave: (data: {
    slug: string;
    title: string;
    body: string;
    published: boolean;
    showInFooter: boolean;
    order: number;
  }) => void;
  saving: boolean;
}

function EditModal({ initial, onClose, onSave, saving }: EditModalProps) {
  const isNew = !initial;

  const bodyQuery = trpc.staticPage.getBySlug.useQuery(
    { slug: initial?.slug ?? "" },
    { enabled: !!initial?.slug },
  );

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(initial?.published ?? true);
  const [showInFooter, setShowInFooter] = useState(
    initial?.showInFooter ?? true,
  );
  const [order, setOrder] = useState(initial?.order ?? 0);

  // Populate body once loaded (edit mode).
  if (!isNew && bodyQuery.data && body === "") {
    setBody(bodyQuery.data.body);
  }

  const handleSave = () => {
    if (!slug.trim() || !title.trim()) {
      toast.error("Slug und Titel sind Pflichtfelder.");
      return;
    }
    onSave({ slug: slug.trim(), title: title.trim(), body, published, showInFooter, order });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {isNew ? "Neue Seite anlegen" : `„${initial.slug}" bearbeiten`}
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="text-muted hover:text-foreground"
          >
            <Icon name="x" size={20} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted">Slug (URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!isNew}
              placeholder="z.B. impressum"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-brand disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Impressum"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted">
            Inhalt (HTML)
          </label>
          {!isNew && bodyQuery.isPending ? (
            <p className="text-sm text-muted">Lädt …</p>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-brand"
              placeholder="<h1>Impressum</h1><p>…</p>"
            />
          )}
          <p className="text-[11px] text-muted">
            HTML ist erlaubt. Nur Admins können diesen Inhalt bearbeiten.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="accent-brand"
            />
            Veröffentlicht
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInFooter}
              onChange={(e) => setShowInFooter(e.target.checked)}
              className="accent-brand"
            />
            Im Footer anzeigen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Reihenfolge:</span>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              min={0}
              max={999}
              aria-label="Reihenfolge im Footer"
              className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>
        </div>

        <footer className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Speichert …" : "Speichern"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-foreground">{children}</td>;
}
