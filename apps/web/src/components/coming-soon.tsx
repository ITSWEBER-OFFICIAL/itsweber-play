import Link from "next/link";

// Shared placeholder for routes that are wired into the header but not yet
// implemented. Better than a raw 404 — the visitor sees what's coming and
// where they are in the roadmap.

export function ComingSoon({
  title,
  description,
  etaLabel,
}: {
  title: string;
  description: string;
  etaLabel: string;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div className="mono mb-4 inline-block rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-wider text-brand">
        {etaLabel}
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 text-muted">{description}</p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium transition hover:bg-surface-raised"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
