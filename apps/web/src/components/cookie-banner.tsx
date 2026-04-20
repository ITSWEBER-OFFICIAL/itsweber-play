"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "play:consent:v1";

type ConsentLevel = "essential" | "all";

function getStoredConsent(): ConsentLevel | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  return v === "essential" || v === "all" ? v : null;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = (level: ConsentLevel) => {
    localStorage.setItem(CONSENT_KEY, level);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie-Einstellungen"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-surface/95 px-6 py-4 shadow-2xl backdrop-blur-sm md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-2xl md:rounded-2xl md:border"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="flex-1 text-sm text-muted">
          Diese Plattform setzt technisch notwendige Cookies ein, um den
          Betrieb zu ermöglichen (Session-Verwaltung). Weitere Tracking-Cookies
          werden nur mit deiner Zustimmung gesetzt.{" "}
          <Link
            href="/datenschutz"
            className="text-brand underline hover:opacity-80"
          >
            Datenschutzerklärung
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => accept("essential")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            Nur notwendige
          </button>
          <button
            type="button"
            onClick={() => accept("all")}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
