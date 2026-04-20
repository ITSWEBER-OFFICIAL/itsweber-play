"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/icon";

interface InfoTooltipProps {
  /** Tooltip-Text (1-2 Sätze). */
  content: string;
  /** Optionaler Link auf /help#<anchor>. */
  helpHref?: string;
  /** Größe des Info-Icons in px. Default 14. */
  size?: number;
  /** Zusätzliche CSS-Klassen für den Button. */
  className?: string;
}

/**
 * Kleines Info-Icon (ⓘ) mit Hover/Focus-Popover.
 * Nutzt aria-describedby + role="tooltip" für Screen-Reader-Kompatibilität.
 *
 * Usage:
 *   <label>Format <InfoTooltip content="Long oder Short..." helpHref="/help#format" /></label>
 */
export function InfoTooltip({ content, helpHref, size = 14, className }: InfoTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }
  function hide(delay = 0) {
    timeoutRef.current = setTimeout(() => setOpen(false), delay);
  }

  return (
    <span className={`relative inline-flex items-center ${className ?? ""}`}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="Mehr Informationen"
        className="rounded-full transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2"
        style={{
          color: "var(--color-text-muted)",
          // focus ring color
          // @ts-expect-error CSS variable
          "--tw-ring-color": "var(--color-brand)",
        }}
        onMouseEnter={show}
        onMouseLeave={() => hide(150)}
        onFocus={show}
        onBlur={() => hide(0)}
      >
        <Icon name="info" size={size} />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={() => hide(150)}
          className="absolute z-50 left-5 bottom-full mb-1.5 w-64 rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-lg"
          style={{
            background: "var(--color-surface-raised, var(--color-surface))",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          {content}
          {helpHref && (
            <a
              href={helpHref}
              className="block mt-1.5 font-medium underline underline-offset-2"
              style={{ color: "var(--color-brand)" }}
            >
              Mehr erfahren →
            </a>
          )}
        </span>
      )}
    </span>
  );
}
