// Branding / Attribution — env-driven with AGPL-3.0 upstream lock.
//
// Fork-User können via NEXT_PUBLIC_*-Env-Vars Namen + URLs für ihre
// Instanz setzen. Defaults sind generisch. Der UPSTREAM-Block darunter
// ist per Lizenz (AGPL-3.0) fest verankert — er darf NICHT per Env
// entfernt werden und MUSS sichtbar im Footer bleiben.

const env = (k: string, fallback: string): string => {
  const v = typeof process !== "undefined" ? process.env?.[k] : undefined;
  return v && v.length > 0 ? v : fallback;
};

// ── Nutzer-Branding (über Env überschreibbar) ────────────────────────
export const APP_NAME = env("NEXT_PUBLIC_APP_NAME", "Play");
export const APP_VERSION = "v0.4.0-dev" as const;
export const PRODUCT_HOMEPAGE = env("NEXT_PUBLIC_PRODUCT_HOMEPAGE", "");
export const VENDOR_NAME = env("NEXT_PUBLIC_VENDOR_NAME", "");
export const VENDOR_URL = env("NEXT_PUBLIC_VENDOR_URL", "");
export const AUTHOR_NAME = env("NEXT_PUBLIC_AUTHOR_NAME", "");
export const AUTHOR_URL = env("NEXT_PUBLIC_AUTHOR_URL", "");

export const COPYRIGHT_NOTICE: string = AUTHOR_NAME
  ? `© ${new Date().getFullYear()} ${AUTHOR_NAME}${VENDOR_NAME ? ` · ${VENDOR_NAME}` : ""}`
  : "";

// ── Upstream-Attribution (AGPL-Pflicht, NICHT per Env ausschaltbar) ──
export const UPSTREAM_NAME = "ITSWEBER Play" as const;
export const UPSTREAM_URL =
  "https://github.com/ITSWEBER-OFFICIAL/itsweber-play" as const;
export const UPSTREAM_LICENSE = "AGPL-3.0" as const;
