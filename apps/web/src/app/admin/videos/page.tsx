"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";
import { toast } from "@/lib/toast";
import { thumbnailUrl } from "@/lib/storage-urls";
import { formatDuration } from "@/components/video-card";

const STATUS_FILTERS = [
  "ALL",
  "LIVE",
  "PROCESSING",
  "PENDING",
  "FAILED",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const FORMAT_FILTERS = ["ALL", "LONG", "SHORT"] as const;
type FormatFilter = (typeof FORMAT_FILTERS)[number];

const VIS_OPTIONS = ["PUBLIC", "UNLISTED", "PRIVATE", "LOGGED_IN"] as const;
type Vis = (typeof VIS_OPTIONS)[number];

export default function AdminVideosPage() {
  return (
    <AdminGate>
      <VideosAdmin />
    </AdminGate>
  );
}

function VideosAdmin() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [format, setFormat] = useState<FormatFilter>("ALL");
  const [search, setSearch] = useState("");

  const videos = trpc.admin.videos.list.useQuery({
    status,
    format,
    search: search || undefined,
    limit: 100,
  });
  const utils = trpc.useUtils();

  const setVisibility = trpc.admin.videos.setVisibility.useMutation({
    onSuccess: () => {
      utils.admin.videos.list.invalidate();
      utils.admin.dashboard.invalidate();
      toast.success("Sichtbarkeit geändert");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteVideo = trpc.admin.videos.delete.useMutation({
    onSuccess: () => {
      utils.admin.videos.list.invalidate();
      utils.admin.dashboard.invalidate();
      toast.success("Video gelöscht");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">
            Videos (global)
          </h1>
          <p className="mt-1 text-sm text-muted">
            Alle Uploads quer über alle Creator. Moderations-Aktionen ohne
            Owner-Zwang.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Titel / Slug / Beschreibung …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand sm:w-72"
          />
          <select
            aria-label="Status-Filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="mono w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground sm:w-auto"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Format-Filter"
        className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-0.5"
      >
        {(
          [
            { key: "ALL" as FormatFilter, label: "Alle" },
            { key: "LONG" as FormatFilter, label: "Videos" },
            { key: "SHORT" as FormatFilter, label: "Shorts" },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={format === tab.key}
            onClick={() => setFormat(tab.key)}
            className={
              "rounded-md px-4 py-1.5 text-xs font-medium transition " +
              (format === tab.key
                ? "bg-brand text-neutral-900"
                : "text-dim hover:text-foreground")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {videos.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : videos.error ? (
        <p className="text-danger">Fehler: {videos.error.message}</p>
      ) : videos.data.length === 0 ? (
        <p className="text-muted">Keine Videos in dieser Ansicht.</p>
      ) : (
        <>
        {/* Desktop: Tabelle */}
        <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
          <table className="w-full text-sm">
            <thead className="bg-background/40">
              <tr className="text-left">
                <Th>Video</Th>
                <Th>Creator / Kanal</Th>
                <Th>Status</Th>
                <Th>Sichtbarkeit</Th>
                <Th>Views</Th>
                <Th>Dauer</Th>
                <Th>
                  <span className="sr-only">Aktionen</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {videos.data.map((v) => (
                <tr
                  key={v.id}
                  className="border-t border-border transition hover:bg-surface-raised/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-[48px] w-[84px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-raised">
                        {v.thumbnailKey ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={thumbnailUrl(v.thumbnailKey)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/watch/${v.slug}`}
                            target="_blank"
                            className="truncate font-semibold text-foreground hover:text-brand"
                          >
                            {v.title}
                          </Link>
                          <span
                            className={
                              "mono shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider " +
                              (v.format === "SHORT"
                                ? "bg-purple-500/20 text-purple-300"
                                : "bg-surface-raised text-dim")
                            }
                          >
                            {v.format === "SHORT" ? "Short" : "Video"}
                          </span>
                        </div>
                        <div className="mono text-[10px] text-dim">
                          {v.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted">
                      @{v.owner.handle}
                    </div>
                    <div className="text-[11px] text-dim">
                      {v.channel.displayName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "mono inline-block rounded px-2 py-0.5 text-[10px] uppercase " +
                        (v.status === "LIVE"
                          ? "bg-success/15 text-success"
                          : v.status === "PROCESSING"
                            ? "bg-brand/15 text-brand"
                            : v.status === "FAILED"
                              ? "bg-danger/15 text-danger"
                              : "bg-warning/15 text-warning")
                      }
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Sichtbarkeit ${v.title}`}
                      value={v.visibility}
                      disabled={setVisibility.isPending}
                      onChange={(e) =>
                        setVisibility.mutate({
                          id: v.id,
                          visibility: e.target.value as Vis,
                        })
                      }
                      className="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-foreground disabled:opacity-50"
                    >
                      {VIS_OPTIONS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 mono text-xs text-muted">
                    {v.viewCount}
                  </td>
                  <td className="px-4 py-3 mono text-xs text-muted">
                    {formatDuration(v.durationSec) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `„${v.title}" wirklich löschen? Hard-Delete.`,
                          )
                        ) {
                          deleteVideo.mutate({ id: v.id });
                        }
                      }}
                      disabled={deleteVideo.isPending}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Stack-Cards */}
        <ul className="space-y-3 md:hidden">
          {videos.data.map((v) => (
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
                  <div className="flex items-start gap-2">
                    <Link
                      href={`/watch/${v.slug}`}
                      target="_blank"
                      className="line-clamp-2 text-sm font-semibold text-foreground hover:text-brand"
                    >
                      {v.title}
                    </Link>
                    <span
                      className={
                        "mono shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider " +
                        (v.format === "SHORT"
                          ? "bg-purple-500/20 text-purple-300"
                          : "bg-surface-raised text-dim")
                      }
                    >
                      {v.format === "SHORT" ? "Short" : "Video"}
                    </span>
                  </div>
                  <div className="mono mt-0.5 truncate text-[10px] text-dim">{v.slug}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    @{v.owner.handle} · {v.channel.displayName}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={
                    "mono inline-block rounded px-2 py-0.5 text-[10px] uppercase " +
                    (v.status === "LIVE"
                      ? "bg-success/15 text-success"
                      : v.status === "PROCESSING"
                        ? "bg-brand/15 text-brand"
                        : v.status === "FAILED"
                          ? "bg-danger/15 text-danger"
                          : "bg-warning/15 text-warning")
                  }
                >
                  {v.status}
                </span>
                <span className="mono text-[11px] text-muted">
                  {v.viewCount.toLocaleString("de-DE")} Views
                </span>
                <span className="mono text-[11px] text-muted">
                  {formatDuration(v.durationSec) ?? "—"}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <select
                  aria-label={`Sichtbarkeit ${v.title}`}
                  value={v.visibility}
                  disabled={setVisibility.isPending}
                  onChange={(e) =>
                    setVisibility.mutate({
                      id: v.id,
                      visibility: e.target.value as Vis,
                    })
                  }
                  className="flex-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-foreground disabled:opacity-50"
                >
                  {VIS_OPTIONS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `„${v.title}" wirklich löschen? Hard-Delete.`,
                      )
                    ) {
                      deleteVideo.mutate({ id: v.id });
                    }
                  }}
                  disabled={deleteVideo.isPending}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
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
