"use client";

import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";

export default function AdminSystemPage() {
  return (
    <AdminGate>
      <SystemPanel />
    </AdminGate>
  );
}

function SystemPanel() {
  const health = trpc.admin.system.health.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-extrabold tracking-tight">System</h1>
        <p className="mt-1 text-sm text-muted">
          Datenbank, Transcoding-Queue, Environment. Aktualisiert sich alle 10 s.
        </p>
      </header>

      {health.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : health.error ? (
        <p className="text-danger">{health.error.message}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="Datenbank">
            <KV
              label="Verbindung"
              value={
                health.data.database.ok ? (
                  <span className="text-success">OK</span>
                ) : (
                  <span className="text-danger">Fehler</span>
                )
              }
            />
            <KV
              label="Migrations applied"
              value={
                <span className="mono text-foreground">
                  {health.data.database.migrations}
                </span>
              }
            />
          </Card>

          <Card title="Transcoding-Queue">
            <KV
              label="In Verarbeitung"
              value={<Pill count={health.data.queue.processing} tone="brand" />}
            />
            <KV
              label="Wartet"
              value={
                <Pill count={health.data.queue.pending} tone="warning" />
              }
            />
            <KV
              label="Fehlgeschlagen"
              value={<Pill count={health.data.queue.failed} tone="danger" />}
            />
            <p className="mono mt-3 text-[10px] text-dim">
              BullMQ-Queue-Tiefe bekommen wir in Session 7 direkt aus Redis —
              hier zeigen wir bis dahin die DB-Spiegelung.
            </p>
          </Card>

          <Card title="Environment">
            {Object.entries(health.data.env).map(([k, v]) => (
              <KV
                key={k}
                label={k}
                value={
                  <span className="mono truncate text-foreground">
                    {v == null || v === "" ? (
                      <span className="text-dim">—</span>
                    ) : (
                      String(v)
                    )}
                  </span>
                }
              />
            ))}
          </Card>
        </div>
      )}
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
      <dl className="space-y-2 text-xs">{children}</dl>
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="mono text-[11px] uppercase tracking-wider text-dim">
        {label}
      </dt>
      <dd className="min-w-0 max-w-[60%] truncate text-right">{value}</dd>
    </div>
  );
}

function Pill({
  count,
  tone,
}: {
  count: number;
  tone: "success" | "brand" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "brand"
        ? "bg-brand/15 text-brand"
        : tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-danger/15 text-danger";
  return (
    <span className={`mono rounded px-2 py-0.5 text-[11px] ${cls}`}>
      {count}
    </span>
  );
}
