// Browser-side re-hydration after a theme change. Opens a single EventSource
// to /api/theme/events; on every `theme:updated` ping it re-fetches the
// current theme via tRPC and swaps the contents of the inline <style> tags
// that the RSC layout rendered at SSR time.
//
// No React re-render — we flip CSS variables, everything cascades.

import { overridesToCssBlock } from "@play/theme";
import { API_URL } from "./trpc";

export interface ThemeState {
  tokensOverride: Record<string, string>;
  customCss: string | null;
  logoFilter: string | null;
  logoUrl: string | null;
  activePreset: string | null;
  updatedAt: string;
}

async function fetchCurrentTheme(): Promise<ThemeState | null> {
  try {
    const res = await fetch(`${API_URL}/api/trpc/theme.get`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { data?: ThemeState } };
    return body.result?.data ?? null;
  } catch {
    return null;
  }
}

function applyTheme(theme: ThemeState) {
  const varsCss = overridesToCssBlock({
    tokensOverride: theme.tokensOverride,
    logoFilter: theme.logoFilter,
  });

  let varsTag = document.getElementById("theme-vars");
  if (!varsTag) {
    varsTag = document.createElement("style");
    varsTag.id = "theme-vars";
    document.head.appendChild(varsTag);
  }
  varsTag.textContent = varsCss;

  let customTag = document.getElementById("theme-custom");
  if (theme.customCss) {
    if (!customTag) {
      customTag = document.createElement("style");
      customTag.id = "theme-custom";
      document.head.appendChild(customTag);
    }
    customTag.textContent = theme.customCss;
  } else if (customTag) {
    customTag.textContent = "";
  }

  // Announce to the admin editor iframe (and any other interested code in the
  // same tab) that the theme has been refreshed. Used by `/admin/theme` so the
  // preview panel stays in sync when someone else on the team edits at the
  // same time.
  window.dispatchEvent(
    new CustomEvent("theme:applied", { detail: theme }),
  );
}

export function startThemeSync(): () => void {
  if (typeof window === "undefined") return () => {};

  const source = new EventSource(`${API_URL}/api/theme/events`, {
    withCredentials: true,
  });

  const onUpdate = async (ev: MessageEvent) => {
    const theme = await fetchCurrentTheme();
    if (theme) applyTheme(theme);
    // If this was a page-blocks change, let React Query listeners know so
    // the homepage/admin iframe refetches `page.list`. Theme-only updates
    // don't need this, but the payload flag is cheap.
    try {
      const payload = ev.data ? JSON.parse(ev.data) : null;
      const source = payload?.source as string | undefined;
      if (source && source.startsWith("page:")) {
        window.dispatchEvent(
          new CustomEvent("page:blocks-updated", { detail: payload }),
        );
      }
    } catch {
      // swallow — data wasn't JSON (shouldn't happen but cheap to guard)
    }
  };

  source.addEventListener("theme:updated", onUpdate);
  source.addEventListener("error", () => {
    // EventSource auto-reconnects; we just log so devs see it in the console.
    if (source.readyState === EventSource.CLOSED) {
      console.debug("[theme-sync] event-source closed");
    }
  });

  return () => {
    source.removeEventListener("theme:updated", onUpdate);
    source.close();
  };
}

// Imperative re-fetch for the admin editor: after a local mutation, the
// admin tab wants to reflect its own change instantly without waiting for
// the SSE round-trip (which will *also* arrive ~100ms later and be a no-op).
export async function refreshThemeNow(): Promise<void> {
  const theme = await fetchCurrentTheme();
  if (theme) applyTheme(theme);
}
