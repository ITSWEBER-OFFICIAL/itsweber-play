"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { thumbnailUrl } from "@/lib/storage-urls";
import { formatDuration } from "@/components/video-card";
import { toast } from "@/lib/toast";
import { UploadMenu } from "@/components/upload-menu";

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: { label: "Wartet", className: "bg-warning/20 text-warning" },
  PROCESSING: { label: "Verarbeitet", className: "bg-brand/20 text-brand" },
  LIVE: { label: "Live", className: "bg-success/20 text-success" },
  FAILED: { label: "Fehler", className: "bg-danger/20 text-danger" },
};

const VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE", "LOGGED_IN"] as const;
type Vis = (typeof VISIBILITIES)[number];

type StatusFilter = "ALL" | "LIVE" | "PROCESSING" | "PENDING" | "FAILED";
type FormatFilter = "ALL" | "LONG" | "SHORT";

export default function StudioVideosPage() {
  return (
    <StudioGate>
      <VideosTable />
    </StudioGate>
  );
}

function VideosTable() {
  const videos = trpc.video.mine.useQuery(undefined, {
    refetchInterval: (query) => {
      if (!query.state.data) return false;
      const active = query.state.data.some(
        (v) => v.status === "PENDING" || v.status === "PROCESSING",
      );
      return active ? 2000 : false;
    },
  });
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("ALL");

  const setVisibility = trpc.video.setVisibility.useMutation({
    onSuccess: () => {
      utils.video.mine.invalidate();
      utils.video.list.invalidate();
      toast.success("Sichtbarkeit aktualisiert");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteVideo = trpc.video.delete.useMutation({
    onSuccess: () => {
      utils.video.mine.invalidate();
      utils.video.list.invalidate();
      utils.studio.dashboard.invalidate();
      toast.success("Video gelöscht");
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = (videos.data ?? []).filter((v) => {
    const statusOk = filter === "ALL" || v.status === filter;
    const formatOk = formatFilter === "ALL" || v.format === formatFilter;
    return statusOk && formatOk;
  });

  const counts = (videos.data ?? []).reduce(
    (acc, v) => {
      if (v.format === "SHORT") acc.short += 1;
      else acc.long += 1;
      acc.all += 1;
      return acc;
    },
    { all: 0, long: 0, short: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">
            Meine Videos
          </h1>
          <p className="mt-1 text-sm text-muted">
            Verwalte alle Uploads, editiere Metadaten, wähle Thumbnails.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <select
            aria-label="Status-Filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="mono w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground sm:w-auto"
          >
            <option value="ALL">Alle Status</option>
            <option value="LIVE">Live</option>
            <option value="PROCESSING">In Verarbeitung</option>
            <option value="PENDING">Wartet</option>
            <option value="FAILED">Fehlgeschlagen</option>
          </select>
          <UploadMenu size="sm" />
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Format-Filter"
        className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-0.5"
      >
        {(
          [
            { key: "ALL" as FormatFilter, label: `Alle (${counts.all})` },
            { key: "LONG" as FormatFilter, label: `Videos (${counts.long})` },
            { key: "SHORT" as FormatFilter, label: `Shorts (${counts.short})` },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={formatFilter === tab.key}
            onClick={() => setFormatFilter(tab.key)}
            className={
              "rounded-md px-4 py-1.5 text-xs font-medium transition " +
              (formatFilter === tab.key
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
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <p className="text-muted">
            {filter === "ALL"
              ? 'Noch keine Uploads — klick "Upload".'
              : "Keine Videos in dieser Ansicht."}
          </p>
        </div>
      ) : (
        <>
        {/* Desktop: Tabelle */}
        <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
          <table className="w-full text-sm">
            <thead className="bg-background/40">
              <tr className="text-left">
                <Th>Video</Th>
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
              {filtered.map((v) => {
                const statusMeta = STATUS_META[v.status] ?? {
                  label: v.status,
                  className: "bg-surface-raised text-muted",
                };
                return (
                  <tr
                    key={v.id}
                    className="border-t border-border transition hover:bg-surface-raised/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-[52px] w-[92px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-raised">
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
                              href={`/studio/${v.id}/edit`}
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
                          {v.status === "FAILED" && v.failureReason && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-danger">
                              {v.failureReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider " +
                          statusMeta.className
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Sichtbarkeit für „${v.title}"`}
                        className="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground disabled:opacity-50"
                        value={v.visibility}
                        disabled={v.status !== "LIVE" || setVisibility.isPending}
                        onChange={(e) =>
                          setVisibility.mutate({
                            id: v.id,
                            visibility: e.target.value as Vis,
                          })
                        }
                      >
                        {VISIBILITIES.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs text-muted">
                        {v.viewCount.toLocaleString("de-DE")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs text-muted">
                        {formatDuration(v.durationSec) ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/studio/${v.id}/edit`}
                          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-brand hover:text-brand"
                        >
                          Editor
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `„${v.title}" wirklich löschen? Kann nicht rückgängig gemacht werden.`,
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
          {filtered.map((v) => {
            const statusMeta = STATUS_META[v.status] ?? {
              label: v.status,
              className: "bg-surface-raised text-muted",
            };
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
                    <div className="flex items-start gap-2">
                      <Link
                        href={`/studio/${v.id}/edit`}
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
                    {v.status === "FAILED" && v.failureReason && (
                      <p className="mt-1 line-clamp-2 text-xs text-danger">
                        {v.failureReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                      statusMeta.className
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {statusMeta.label}
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
                    aria-label={`Sichtbarkeit für „${v.title}"`}
                    className="flex-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-foreground disabled:opacity-50"
                    value={v.visibility}
                    disabled={v.status !== "LIVE" || setVisibility.isPending}
                    onChange={(e) =>
                      setVisibility.mutate({
                        id: v.id,
                        visibility: e.target.value as Vis,
                      })
                    }
                  >
                    {VISIBILITIES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                  <Link
                    href={`/studio/${v.id}/edit`}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-brand hover:text-brand"
                  >
                    Editor
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `„${v.title}" wirklich löschen? Kann nicht rückgängig gemacht werden.`,
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
            );
          })}
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
