"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";

const STATUS_FILTERS = [
  "OPEN",
  "RESOLVED_TAKEDOWN",
  "RESOLVED_IGNORED",
  "ALL",
] as const;
type Status = (typeof STATUS_FILTERS)[number];

export default function AdminModerationPage() {
  return (
    <AdminGate>
      <Moderation />
    </AdminGate>
  );
}

function Moderation() {
  const [status, setStatus] = useState<Status>("OPEN");
  const reports = trpc.report.list.useQuery({ status, limit: 100 });
  const utils = trpc.useUtils();

  const resolve = trpc.report.resolve.useMutation({
    onSuccess: (_d, vars) => {
      utils.report.list.invalidate();
      utils.report.openCount.invalidate();
      utils.admin.dashboard.invalidate();
      toast.success(
        vars.action === "TAKEDOWN" ? "Takedown erfolgt" : "Meldung ignoriert",
      );
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">
            Moderation-Queue
          </h1>
          <p className="mt-1 text-sm text-muted">
            Gemeldete Videos / Kommentare / Kanäle. Takedown setzt das Target
            auf PRIVATE (Video) bzw. soft-delete (Kommentar).
          </p>
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={
                "mono rounded-md px-3 py-2 text-[11px] font-medium transition " +
                (s === status
                  ? "bg-brand/15 text-brand"
                  : "border border-border text-muted hover:bg-surface")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      {reports.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : reports.error ? (
        <p className="text-danger">{reports.error.message}</p>
      ) : (reports.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <p className="text-muted">Keine Reports in dieser Ansicht.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.data!.map((r) => {
            const targetLink =
              r.targetType === "VIDEO" && r.videoId
                ? `/watch/${r.videoId}`
                : null;
            return (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono rounded bg-brand/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand">
                        {r.targetType}
                      </span>
                      <span
                        className={
                          "mono rounded px-2 py-0.5 text-[10px] uppercase tracking-wider " +
                          (r.status === "OPEN"
                            ? "bg-warning/15 text-warning"
                            : r.status === "RESOLVED_TAKEDOWN"
                              ? "bg-danger/15 text-danger"
                              : "bg-surface-raised text-muted")
                        }
                      >
                        {r.status}
                      </span>
                      <span className="mono rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-foreground">
                        #{r.reason}
                      </span>
                      <span className="mono text-[10px] text-dim">
                        {new Date(r.createdAt).toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      Ziel-ID:{" "}
                      <span className="mono text-brand">
                        {r.videoId ?? r.commentId ?? r.channelId ?? "—"}
                      </span>
                      {targetLink && (
                        <>
                          {" · "}
                          <Link
                            href={targetLink}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-brand hover:underline"
                          >
                            öffnen <Icon name="external" size={12} />
                          </Link>
                        </>
                      )}
                    </div>
                    {r.note && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                        {r.note}
                      </p>
                    )}
                    <p className="mono mt-2 text-[11px] text-dim">
                      Gemeldet von @{r.reporter.handle} · {r.reporter.email}
                      {r.resolvedBy && (
                        <>
                          {" · "}Bearbeitet von @{r.resolvedBy.handle}
                        </>
                      )}
                    </p>
                  </div>
                  {r.status === "OPEN" && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Takedown ausführen? Target wird PRIVATE / gelöscht.",
                            )
                          ) {
                            resolve.mutate({ id: r.id, action: "TAKEDOWN" });
                          }
                        }}
                        className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                      >
                        Takedown
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          resolve.mutate({ id: r.id, action: "IGNORE" })
                        }
                        className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-border-strong"
                      >
                        Ignorieren
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
