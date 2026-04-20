"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Tab-Switch zwischen Datei-Upload (/studio/upload) und URL-Import
// (/studio/import). Das `?format=short`-Query bleibt erhalten, damit der
// gewählte Long/Short-Modus beim Wechsel nicht verloren geht.

export function SourceToggle({ active }: { active: "upload" | "import" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(next: "upload" | "import") {
    if (next === active) return;
    const params = new URLSearchParams(searchParams.toString());
    const qs = params.toString();
    const target = next === "upload" ? "/studio/upload" : "/studio/import";
    router.push(qs ? `${target}?${qs}` : target);
  }

  return (
    <div
      role="tablist"
      aria-label="Quelle wählen"
      className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-0.5"
    >
      {(
        [
          { key: "upload" as const, label: "Datei hochladen" },
          { key: "import" as const, label: "Per URL importieren" },
        ]
      ).map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => navigate(tab.key)}
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
