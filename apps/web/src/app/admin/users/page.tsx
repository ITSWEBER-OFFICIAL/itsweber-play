"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { AdminGate } from "@/components/admin-gate";
import { toast } from "@/lib/toast";

const ROLES = ["ADMIN", "MODERATOR", "CREATOR", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

type UserRow = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  role: string;
  banned: boolean;
  createdAt: Date | string;
  _count: { videos: number; channels: number };
};

export default function AdminUsersPage() {
  return (
    <AdminGate>
      <UsersTable />
    </AdminGate>
  );
}

function UsersTable() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { id: string } | undefined;
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const users = trpc.admin.users.list.useQuery({ search: search || undefined });
  const utils = trpc.useUtils();

  const setRole = trpc.admin.users.setRole.useMutation({
    onSuccess: () => { utils.admin.users.list.invalidate(); utils.admin.dashboard.invalidate(); toast.success("Rolle geändert"); },
    onError: (err) => toast.error(err.message),
  });
  const setBan = trpc.admin.users.setBan.useMutation({
    onSuccess: (_d, vars) => { utils.admin.users.list.invalidate(); utils.admin.dashboard.invalidate(); toast.success(vars.banned ? "User gesperrt" : "User entsperrt"); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Nutzer-Verwaltung</h1>
          <p className="mt-1 text-sm text-muted">Rollen anpassen, User sperren/entsperren, bearbeiten oder löschen.</p>
        </div>
        <input
          type="search"
          placeholder="Suche E-Mail / Handle / Name …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand sm:w-72"
        />
      </header>

      {users.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : users.error ? (
        <p className="text-danger">Fehler: {users.error.message}</p>
      ) : users.data.length === 0 ? (
        <p className="text-muted">Keine Treffer.</p>
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-background/40">
                <tr className="text-left">
                  <Th>User</Th>
                  <Th>Rolle</Th>
                  <Th>Status</Th>
                  <Th>Videos · Kanäle</Th>
                  <Th>Seit</Th>
                  <Th><span className="sr-only">Aktionen</span></Th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => {
                  const isSelf = u.id === sessionUser?.id;
                  return (
                    <tr key={u.id} className="border-t border-border transition hover:bg-surface-raised/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{u.displayName}</div>
                        <div className="text-xs text-muted">@{u.handle} · {u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Rolle für ${u.email}`}
                          value={u.role}
                          disabled={isSelf || setRole.isPending}
                          onChange={(e) => setRole.mutate({ userId: u.id, role: e.target.value as Role })}
                          className="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-foreground disabled:opacity-60"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {u.banned ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-danger">gesperrt</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-success">aktiv</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <span className="mono">{u._count.videos}</span> · <span className="mono">{u._count.channels}</span>
                      </td>
                      <td className="px-4 py-3 mono text-xs text-muted">
                        {new Date(u.createdAt).toLocaleDateString("de-DE")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditUser(u as unknown as UserRow)}
                            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:border-brand hover:text-brand"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            disabled={isSelf || setBan.isPending}
                            onClick={() => setBan.mutate({ userId: u.id, banned: !u.banned })}
                            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:border-border-strong hover:text-foreground disabled:opacity-50"
                          >
                            {u.banned ? "Entsperren" : "Sperren"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Stack-Cards */}
          <ul className="space-y-3 md:hidden">
            {users.data.map((u) => {
              const isSelf = u.id === sessionUser?.id;
              return (
                <li
                  key={u.id}
                  className="rounded-xl border border-border bg-surface p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{u.displayName}</div>
                      <div className="truncate text-xs text-muted">@{u.handle}</div>
                      <div className="mt-0.5 truncate text-xs text-dim">{u.email}</div>
                    </div>
                    {u.banned ? (
                      <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger">gesperrt</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">aktiv</span>
                    )}
                  </div>
                  <div className="mono mt-2 text-[11px] text-dim">
                    <span className="text-muted">{u._count.videos}</span> Videos · <span className="text-muted">{u._count.channels}</span> Kanäle · seit {new Date(u.createdAt).toLocaleDateString("de-DE")}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Rolle für ${u.email}`}
                      value={u.role}
                      disabled={isSelf || setRole.isPending}
                      onChange={(e) => setRole.mutate({ userId: u.id, role: e.target.value as Role })}
                      className="flex-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-foreground disabled:opacity-60"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEditUser(u as unknown as UserRow)}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand hover:text-brand"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      disabled={isSelf || setBan.isPending}
                      onClick={() => setBan.mutate({ userId: u.id, banned: !u.banned })}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-border-strong hover:text-foreground disabled:opacity-50"
                    >
                      {u.banned ? "Entsperren" : "Sperren"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          isSelf={editUser.id === sessionUser?.id}
          onClose={() => setEditUser(null)}
          onSaved={() => { utils.admin.users.list.invalidate(); setEditUser(null); }}
        />
      )}
    </div>
  );
}

function EditUserModal({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: UserRow;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [handle, setHandle] = useState(user.handle);
  const [email, setEmail] = useState(user.email);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = trpc.admin.users.update.useMutation({
    onSuccess: () => { toast.success("User aktualisiert"); onSaved(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteUser = trpc.admin.users.delete.useMutation({
    onSuccess: () => { toast.success("User gelöscht"); onSaved(); },
    onError: (err) => toast.error(err.message),
  });
  const sendReset = trpc.admin.users.sendPasswordReset.useMutation({
    onSuccess: (data) => toast.success(`Passwort-Reset-Mail gesendet an ${data.email}`),
    onError: (err) => toast.error(err.message),
  });

  function handleSave() {
    const patch: Record<string, string> = {};
    if (displayName !== user.displayName) patch.displayName = displayName;
    if (handle !== user.handle) patch.handle = handle;
    if (email !== user.email) patch.email = email;
    if (Object.keys(patch).length === 0) { onClose(); return; }
    update.mutate({ userId: user.id, ...patch });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="my-auto w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">User bearbeiten</h2>
            <p className="text-xs text-muted mt-0.5">@{user.handle} · {user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
            aria-label="Schließen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Anzeigename</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Handle</span>
              <div className="flex items-center rounded-lg border border-border bg-surface-raised px-3 py-2 focus-within:border-brand">
                <span className="text-sm text-muted">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  className="flex-1 bg-transparent pl-1 text-sm text-foreground outline-none"
                />
              </div>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">E-Mail-Adresse</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>

          {/* Aktionen */}
          <div className="rounded-xl border border-border bg-background/40 px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Weitere Aktionen</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sendReset.isPending}
                onClick={() => sendReset.mutate({ userId: user.id })}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {sendReset.isPending ? "Sendet …" : "Passwort-Reset-Mail senden"}
              </button>
              {!isSelf && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-danger">Wirklich löschen?</span>
                    <button
                      type="button"
                      onClick={() => deleteUser.mutate({ userId: user.id })}
                      disabled={deleteUser.isPending}
                      className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-danger/80 disabled:opacity-50"
                    >
                      {deleteUser.isPending ? "Löscht …" : "Ja, löschen"}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-muted hover:text-foreground">Abbrechen</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/20"
                  >
                    Account löschen
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={update.isPending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-neutral-900 shadow-[0_0_16px_rgba(63,228,139,0.3)] transition hover:bg-brand-hover disabled:opacity-60"
          >
            {update.isPending ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </th>
  );
}
