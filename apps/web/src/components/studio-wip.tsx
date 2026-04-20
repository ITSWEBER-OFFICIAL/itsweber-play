// Shared placeholder used by /studio/* routes that are in the sidebar but
// haven't been implemented yet. Replaces a raw 404 with a friendly note
// indicating the planned milestone for the feature.

export function StudioWip({
  title,
  etaLabel,
  description,
}: {
  title: string;
  etaLabel: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center">
      <div className="mono mb-3 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-wider text-brand">
        {etaLabel}
      </div>
      <h1 className="text-[24px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>
    </div>
  );
}
