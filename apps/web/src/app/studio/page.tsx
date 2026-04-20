"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { thumbnailUrl } from "@/lib/storage-urls";
import { formatDuration } from "@/components/video-card";
import { UploadMenu } from "@/components/upload-menu";

export default function StudioDashboard() {
  return (
    <StudioGate>
      <Dashboard />
    </StudioGate>
  );
}

function Dashboard() {
  const dashboard = trpc.studio.dashboard.useQuery();
  const recent = trpc.video.mine.useQuery({ limit: 6 });

  const stats = dashboard.data?.stats;
  const counts = dashboard.data?.counts;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
            Play Studio
          </h1>
          <p className="mt-1 text-sm text-muted">
            Deine Videos, Kanal-Stats und Tools auf einen Blick.
          </p>
        </div>
        <UploadMenu label="Neues Video" />
      </header>

      {/* Stats-Row */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Videos"
          value={stats?.videos ?? "…"}
          delta={
            counts
              ? `${counts.live} live · ${counts.processing + counts.draft} offen`
              : undefined
          }
        />
        <StatCard
          label="Views (bisher)"
          value={formatNumber(stats?.views30d)}
          delta="v0.2 wird 30-Tage-Fenster"
        />
        <StatCard
          label="Watch-Time"
          value={stats ? `${stats.watchTimeHours} h` : "…"}
          delta="geschätzt, Retention v0.3"
        />
        <StatCard
          label="Abonnenten"
          value={stats?.subscribers ?? 0}
          delta="Subs-Schema kommt Session 7"
        />
      </section>

      {/* Status-Breakdown */}
      {counts && counts.total > 0 && (
        <section className="flex flex-wrap gap-2">
          <StatusPill label="Live" count={counts.live} tone="success" />
          <StatusPill label="In Verarbeitung" count={counts.processing} tone="brand" />
          <StatusPill label="Wartet" count={counts.draft} tone="warning" />
          <StatusPill label="Fehler" count={counts.failed} tone="danger" />
        </section>
      )}

      {/* Recent videos */}
      <section>
        <header className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">Zuletzt hochgeladen</h2>
          <Link href="/studio/videos" className="text-sm text-brand hover:underline">
            Alle Videos →
          </Link>
        </header>

        {recent.isPending ? (
          <p className="text-sm text-muted">Lädt …</p>
        ) : recent.error ? (
          <p className="text-sm text-danger">{recent.error.message}</p>
        ) : (recent.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
            <p className="text-muted">Noch keine Uploads.</p>
            <Link
              href="/studio/upload"
              className="mt-3 inline-block text-brand hover:underline"
            >
              Erstes Video hochladen →
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.data.map((v) => (
              <li
                key={v.id}
                className="flex gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-brand/40"
              >
                <div className="h-[64px] w-[112px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-raised">
                  {v.thumbnailKey ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbnailUrl(v.thumbnailKey)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/studio/${v.id}/edit`}
                    className="line-clamp-2 text-sm font-semibold text-foreground hover:text-brand"
                  >
                    {v.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                    <span className="mono">{v.status}</span>
                    <span className="text-dim">·</span>
                    <span className="mono">
                      {formatDuration(v.durationSec) ?? "—"}
                    </span>
                    <span className="text-dim">·</span>
                    <span>{v.visibility}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mono text-[11px] uppercase tracking-wider text-dim">
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
        {value}
      </div>
      {delta && (
        <div className="mono mt-1 text-[11px] text-muted">{delta}</div>
      )}
    </div>
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

function formatNumber(n: number | undefined): string {
  if (n == null) return "…";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
}
