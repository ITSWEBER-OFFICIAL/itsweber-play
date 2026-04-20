// Shared placeholder for /admin/* routes not yet implemented. Mirrors the
// studio-wip component but lives in the Admin Gate, so non-admins still get
// the Forbidden screen.

import { AdminGate } from "./admin-gate";

export function AdminWip({
  title,
  etaLabel,
  description,
}: {
  title: string;
  etaLabel: string;
  description: string;
}) {
  return (
    <AdminGate>
      <div className="flex min-h-[60vh] flex-col items-start justify-center">
        <div className="mono mb-3 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-wider text-brand">
          {etaLabel}
        </div>
        <h1 className="text-[24px] font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>
      </div>
    </AdminGate>
  );
}
