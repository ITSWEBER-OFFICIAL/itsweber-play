// Server-side theme fetch for the RSC <head> — skips the tRPC client on
// purpose (per docs/03-theming.md) so we don't bundle the batch-link into the
// root layout. Cached per-request only; cross-request changes propagate via
// Next's default dynamic rendering.

import { overridesToCssBlock } from "@play/theme";

export interface ThemeState {
  tokensOverride: Record<string, string>;
  customCss: string | null;
  logoFilter: string | null;
  logoUrl: string | null;
  activePreset: string | null;
  updatedAt: string;
}

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export async function fetchTheme(): Promise<ThemeState | null> {
  try {
    const res = await fetch(`${API_URL}/api/trpc/theme.get`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: { data?: ThemeState };
    };
    return body.result?.data ?? null;
  } catch {
    // API not up yet (e.g. during `next build` of an image without the API).
    // The default theme still renders from the compiled primitives.
    return null;
  }
}

// Build the three style-tag contents expected by docs/03-theming.md §Ebene-Reihenfolge.
// `primitives.css` + `semantic.css` are imported via globals.css (Tailwind v4
// `@theme`) and appear in the stylesheet chain *before* anything inline here.
export function buildThemeVarsCss(theme: ThemeState | null): string {
  if (!theme) return "";
  return overridesToCssBlock({
    tokensOverride: theme.tokensOverride,
    logoFilter: theme.logoFilter,
  });
}
