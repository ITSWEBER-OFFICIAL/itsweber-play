// Gemeinsame Page-Shell für /auth/forgot-password, /auth/reset-password,
// /auth/verify-email. Distinctive Look: Split-Layout mit animiertem
// Aurora-Blob links und einer glas-artigen Form-Card rechts.
//
// Bewusst eigenständig — die öffentlichen (auth)-Pages (/login, /register)
// haben den minimalistischeren Look, damit bestehende User sich nicht im
// Flow fragen, was neu ist.

import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  heading,
  lede,
  children,
}: {
  eyebrow: string;
  heading: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Aurora-Glow-Hintergrund — Brand-Akzent als radialer Gradient, kein
          hartkodiertes Atom-Grün, stattdessen `var(--color-brand)`. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 20%, color-mix(in oklab, var(--color-brand) 22%, transparent) 0%, transparent 60%), radial-gradient(40% 40% at 85% 80%, color-mix(in oklab, var(--color-brand) 14%, transparent) 0%, transparent 55%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-[1fr_480px]">
        <aside className="hidden flex-col justify-between lg:flex">
          <Link href="/" className="inline-flex items-center gap-3 self-start">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand shadow-[0_0_22px_rgba(63,228,139,0.55)]">
              <PlayGlyph />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">ITSWEBER Play</span>
          </Link>

          <div className="max-w-md space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
            <h1 className="text-[44px] font-extrabold leading-[1.05] tracking-tight text-foreground">
              {heading}
            </h1>
            <p className="text-[15px] leading-relaxed text-muted">{lede}</p>
          </div>

          <p className="text-xs text-dim">© {new Date().getFullYear()} ITSWEBER · Alle Videos gehören den Creators.</p>
        </aside>

        <section className="relative">
          {/* Glas-Karte — semi-transparent über dem Aurora-Hintergrund. */}
          <div className="rounded-2xl border border-border bg-surface/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="mb-6 lg:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{heading}</h1>
              <p className="mt-2 text-sm text-muted">{lede}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function PlayGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 5v14l12-7L7 5z" fill="#0A1A26" />
    </svg>
  );
}
