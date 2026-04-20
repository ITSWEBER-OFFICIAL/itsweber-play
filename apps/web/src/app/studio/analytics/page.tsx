"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { thumbnailUrl } from "@/lib/storage-urls";
import { formatDuration } from "@/components/video-card";
import { Icon } from "@/components/icon";

type Period = "7d" | "30d" | "90d";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 Tage" },
  { value: "30d", label: "30 Tage" },
  { value: "90d", label: "90 Tage" },
];

export default function StudioAnalyticsPage() {
  return (
    <StudioGate>
      <Analytics />
    </StudioGate>
  );
}

function Analytics() {
  const [period, setPeriod] = useState<Period>("30d");
  const analytics = trpc.studio.analytics.useQuery({ period });

  const data = analytics.data;
  const maxViews = Math.max(
    1,
    ...(data?.topVideos ?? []).map((v) => v.viewCount),
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted">
            Deine Reichweite, Watch-Time und Top-Videos.
          </p>
        </div>
        <div
          role="tablist"
          className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-0.5"
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={period === p.value ? "true" : "false"}
              onClick={() => setPeriod(p.value)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition " +
                (period === p.value
                  ? "bg-brand text-neutral-900"
                  : "text-dim hover:text-foreground")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Views"
          value={formatNumber(data?.totalViews)}
          hint={`im ${PERIODS.find((p) => p.value === period)?.label}`}
        />
        <StatCard
          label="Watch-Time"
          value={data ? `${data.totalWatchTimeH} h` : "…"}
          hint="geschätzt · 60 % Retention"
        />
        <StatCard
          label="Abonnenten"
          value={formatNumber(data?.totalSubscribers)}
          hint="Gesamt (Lifetime)"
        />
        <StatCard
          label="Live-Videos"
          value={formatNumber(data?.totalVideosLive)}
          hint="PUBLIC + LIVE"
        />
      </section>

      <section>
        <header className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">Top-Videos</h2>
          <Link
            href="/studio/videos"
            className="text-sm text-brand hover:underline"
          >
            Alle Videos →
          </Link>
        </header>

        {analytics.isPending ? (
          <p className="text-sm text-muted">Lädt …</p>
        ) : (data?.topVideos ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
            <Icon name="bar-chart" size={28} className="mx-auto text-dim" />
            <p className="mt-3 text-muted">
              Noch keine Videos im gewählten Zeitraum.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: Tabelle */}
            <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
              <table className="w-full">
                <thead className="border-b border-border bg-surface-raised">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-dim">
                    <th className="px-4 py-3 font-semibold">Video</th>
                    <th className="px-4 py-3 font-semibold">Views</th>
                    <th className="px-4 py-3 font-semibold">Likes</th>
                    <th className="px-4 py-3 font-semibold">Kommentare</th>
                    <th className="px-4 py-3 font-semibold">Dauer</th>
                    <th className="px-4 py-3 font-semibold">Upload</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.topVideos.map((v) => {
                    const barPct = (v.viewCount / maxViews) * 100;
                    return (
                      <tr
                        key={v.id}
                        className="border-b border-border last:border-0 hover:bg-surface-raised"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-[40px] w-[70px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-raised">
                              {v.thumbnailKey ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={thumbnailUrl(v.thumbnailKey)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <Link
                              href={`/studio/${v.id}/edit`}
                              className="line-clamp-2 max-w-[280px] text-sm font-semibold text-foreground hover:text-brand"
                            >
                              {v.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="mono w-16 text-sm font-semibold">
                              {formatNumber(v.viewCount)}
                            </span>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-raised">
                              {/* Dynamic width — inline style is the only option */}
                              {/* eslint-disable-next-line react/forbid-dom-props */}
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="mono px-4 py-3 text-sm">
                          {formatNumber(v.likeCount)}
                        </td>
                        <td className="mono px-4 py-3 text-sm">
                          {formatNumber(v.commentCount)}
                        </td>
                        <td className="mono px-4 py-3 text-sm text-muted">
                          {formatDuration(v.durationSec) ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted">
                          {v.publishedAt
                            ? new Date(v.publishedAt).toLocaleDateString(
                                "de-DE",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: Stack-Cards */}
            <ul className="space-y-3 md:hidden">
              {data!.topVideos.map((v) => {
                const barPct = (v.viewCount / maxViews) * 100;
                return (
                  <li
                    key={v.id}
                    className="rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="flex gap-3">
                      <div className="h-[54px] w-[96px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-raised">
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
                        <div className="mono mt-1 text-[11px] text-muted">
                          {v.publishedAt
                            ? new Date(v.publishedAt).toLocaleDateString(
                                "de-DE",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                          {" · "}
                          {formatDuration(v.durationSec) ?? "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="mono w-16 shrink-0 text-sm font-semibold">
                        {formatNumber(v.viewCount)}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                        {/* Dynamic width — inline style is the only option */}
                        {/* eslint-disable-next-line react/forbid-dom-props */}
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mono mt-2 flex items-center gap-4 text-[11px] text-muted">
                      <span>
                        <Icon
                          name="heart"
                          size={12}
                          className="mr-1 inline align-[-1px]"
                        />
                        {formatNumber(v.likeCount)}
                      </span>
                      <span>
                        <Icon
                          name="message"
                          size={12}
                          className="mr-1 inline align-[-1px]"
                        />
                        {formatNumber(v.commentCount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mono text-[11px] uppercase tracking-wider text-dim">
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
        {value}
      </div>
      {hint && <div className="mono mt-1 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function formatNumber(n: number | undefined | null): string {
  if (n == null) return "…";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
}
