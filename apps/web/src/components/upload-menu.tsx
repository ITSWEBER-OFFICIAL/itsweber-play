"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

// Split-Dropdown: "+ Video" öffnet ein Menü mit "Datei hochladen" und
// "Per URL importieren". Der Hauptklick geht auf Upload (häufigster Fall),
// das Caret daneben öffnet die Optionsliste. Ersetzt überall den einfachen
// "Upload"-Button — Header, Studio-Dashboard, Video-Liste, Empty-States.

type Variant = "primary" | "ghost";
type Size = "sm" | "md" | "lg";

export function UploadMenu({
  variant = "primary",
  size = "md",
  label = "Video",
}: {
  variant?: Variant;
  size?: Size;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sizeCls =
    size === "sm"
      ? "text-xs"
      : size === "lg"
        ? "text-base"
        : "text-sm";
  const padCls =
    size === "sm"
      ? "px-3 py-1.5"
      : size === "lg"
        ? "px-5 py-3"
        : "px-4 py-2";
  const caretPadCls =
    size === "sm" ? "px-2 py-1.5" : size === "lg" ? "px-3 py-3" : "px-2.5 py-2";
  const baseCls =
    variant === "primary"
      ? "bg-brand text-neutral-900 hover:bg-brand-hover [box-shadow:var(--shadow-glow)]"
      : "border border-border-strong bg-surface text-foreground hover:bg-surface-raised";

  return (
    <div ref={ref} className="relative inline-flex">
      <Link
        href="/studio/upload"
        className={
          "inline-flex items-center gap-2 rounded-l-md font-medium transition " +
          baseCls +
          " " +
          sizeCls +
          " " +
          padCls
        }
      >
        <Icon name="plus" size={size === "sm" ? 12 : 14} strokeWidth={2.5} />
        {label}
      </Link>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Weitere Upload-Optionen"
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          "inline-flex items-center rounded-r-md border-l transition " +
          (variant === "primary"
            ? "border-neutral-900/20 bg-brand text-neutral-900 hover:bg-brand-hover"
            : "border-border-strong bg-surface text-foreground hover:bg-surface-raised") +
          " " +
          caretPadCls
        }
      >
        <Icon name="chevron-down" size={size === "sm" ? 12 : 14} strokeWidth={2.5} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-card)]"
        >
          <MenuLink
            href="/studio/upload"
            icon="upload"
            label="Datei hochladen"
            hint="MP4 / MOV / MKV · max. 8 GB"
            onClick={() => setOpen(false)}
          />
          <MenuLink
            href="/studio/import"
            icon="link"
            label="Per URL importieren"
            hint="YouTube / Vimeo / … via yt-dlp"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  hint,
  onClick,
}: {
  href: string;
  icon: "upload" | "link";
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-start gap-3 border-b border-border px-3 py-2.5 transition last:border-b-0 hover:bg-surface-raised"
      role="menuitem"
    >
      <span className="mt-0.5 text-brand">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="block text-[11px] text-dim">{hint}</span>
      </span>
    </Link>
  );
}
