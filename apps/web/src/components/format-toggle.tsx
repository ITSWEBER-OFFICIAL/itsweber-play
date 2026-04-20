"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Tab-Switch zwischen Long-Video- und Short-Modus auf den Upload-/Import-
// Seiten. Schreibt nur den `?format=short`-Query — die Page liest ihn
// aktuell als Label-Hint. Der Worker klassifiziert beim Transcode
// final nach Aspect-Ratio + Dauer.

export function FormatToggle({ active }: { active: "video" | "short" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFormat(next: "video" | "short") {
    if (next === active) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "short") params.set("format", "short");
    else params.delete("format");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div
      role="tablist"
      aria-label="Format wählen"
      className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-0.5"
    >
      {(
        [
          { key: "video" as const, label: "Video (Long-Form)" },
          { key: "short" as const, label: "Short (≤ 60 s, hochformat)" },
        ]
      ).map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => setFormat(tab.key)}
          className={
            "rounded-md px-4 py-1.5 text-xs font-medium transition " +
            (active === tab.key
              ? "bg-brand text-neutral-900"
              : "text-dim hover:text-foreground")
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
