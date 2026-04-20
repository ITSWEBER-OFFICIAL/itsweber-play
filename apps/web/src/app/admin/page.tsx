"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";

interface AuditRow {
  id: string;
  action: string;
  createdAt: string;
  user: { handle: string } | null;
}

export default function AdminDashboardPage() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}

function Dashboard() {
  const dashboard = trpc.admin.dashboard.useQuery();
  const audit = trpc.theme.listAuditLog.useQuery({ limit: 8 });

  const d = dashboard.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
            Admin · Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Überblick über Nutzer, Inhalte, System-Gesundheit.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/users"
            className="rounded-md border border-border-strong bg-surface px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-surface-raised"
          >
            Nutzer verwalten
          </Link>
          <Link
            href="/admin/theme"
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover [box-shadow:var(--shadow-glow)]"
          >
            Theme-Editor
          </Link>
        </div>
      </header>

      {/* Stats-Row */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Nutzer"
          value={d?.users.total ?? "…"}
          delta={
            d
              ? `${d.users.new7d} neu · ${d.users.banned} gesperrt`
              : undefined
          }
          href="/admin/users"
        />
        <StatCard
          label="Videos"
          value={d?.videos.total ?? "…"}
          delta={
            d
              ? `${d.videos.publicLive} public · ${d.videos.live} live`
              : undefined
          }
          href="/admin/videos"
        />
        <StatCard
          label="Gesamt-Views"
          value={formatNumber(d?.views.total)}
          delta="Tracking folgt"
        />
        <StatCard
          label="Kanäle"
          value={d?.channels.total ?? "…"}
          delta={
            d ? `${d.theme.auditToday} Theme-Edits heute` : undefined
          }
        />
      </section>

      {/* Status pills */}
      {d && (
        <section className="flex flex-wrap gap-2">
          <StatusPill
            label="Public live"
            count={d.videos.publicLive}
            tone="success"
          />
          <StatusPill
            label="In Verarbeitung"
            count={d.videos.processing}
            tone="brand"
          />
          <StatusPill label="Fehler" count={d.videos.failed} tone="danger" />
          <StatusPill
            label="Aktive Nutzer"
            count={d.users.total - d.users.banned}
            tone="brand"
          />
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Schnell-Aktionen">
          <ul className="grid grid-cols-2 gap-2">
            <QuickLink
              href="/admin/videos"
              label="Videos moderieren"
              desc="Global über alle Uploads"
            />
            <QuickLink
              href="/admin/users"
              label="User sperren/entsperren"
              desc="Rollen, Bans"
            />
            <QuickLink
              href="/admin/page-blocks"
              label="Startseite + Featured-Video"
              desc="Hero-Block wählt das Featured Video"
            />
            <QuickLink
              href="/admin/system"
              label="System-Health"
              desc="Queue, DB, Storage"
            />
          </ul>
        </Card>

        <Card title="Letzte Theme-Events">
          {audit.isPending ? (
            <p className="text-xs text-muted">Lädt …</p>
          ) : (audit.data ?? []).length === 0 ? (
            <p className="text-xs text-dim">Noch keine Events.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(audit.data as unknown as AuditRow[]).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-surface-raised px-2 py-1"
                >
                  <span className="mono text-brand">{e.action}</span>
                  <span className="truncate text-muted">
                    @{e.user?.handle ?? "—"}
                  </span>
                  <span className="mono text-[10px] text-dim">
                    {new Date(e.createdAt).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  delta,
  href,
}: {
  label: string;
  value: string | number;
  delta?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="mono text-[11px] uppercase tracking-wider text-dim">
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
        {value}
      </div>
      {delta && (
        <div className="mono mt-1 text-[11px] text-muted">{delta}</div>
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-border bg-surface p-4 transition hover:border-brand/40 hover:bg-surface-raised"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">{body}</div>
  );
}

function StatusPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "success" | "brand" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "brand"
        ? "bg-brand/15 text-brand"
        : tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-danger/15 text-danger";
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium " +
        toneCls
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
      <span className="mono opacity-80">{count}</span>
    </span>
  );
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-border bg-surface-raised p-3 transition hover:border-brand/40 hover:bg-surface-hover"
      >
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-[11px] text-dim">{desc}</div>
      </Link>
    </li>
  );
}

function formatNumber(n: number | undefined): string {
  if (n == null) return "…";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
}
