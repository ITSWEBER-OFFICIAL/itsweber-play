"use client";

import Link from "next/link";

interface CtaConfig {
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function CtaBannerBlock({ config }: { config: CtaConfig }) {
  const headline = config.headline ?? "Leg los — lad dein erstes Video hoch.";
  const body =
    config.body ??
    "ITSWEBER Play nimmt MP4/MOV/MKV, transcoded zu HLS und served adaptive Streams.";
  const ctaLabel = config.ctaLabel ?? "Video hochladen";
  const ctaHref = config.ctaHref ?? "/studio/upload";

  // Internal links via next/Link; external stay as plain <a>.
  const isExternal = /^https?:\/\//.test(ctaHref);

  return (
    <section className="my-10 overflow-hidden rounded-3xl border border-border-strong bg-gradient-to-br from-surface to-surface-raised p-10 md:p-14 [box-shadow:var(--shadow-card)]">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-[clamp(22px,2.8vw,32px)] font-bold leading-tight tracking-[-0.02em]">
            {headline}
          </h2>
          <p className="mt-3 text-muted">{body}</p>
        </div>
        {isExternal ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover [box-shadow:var(--shadow-glow)]"
          >
            {ctaLabel}
          </a>
        ) : (
          <Link
            href={ctaHref}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover [box-shadow:var(--shadow-glow)]"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
