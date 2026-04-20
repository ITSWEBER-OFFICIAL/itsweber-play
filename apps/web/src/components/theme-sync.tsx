"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { startThemeSync } from "@/lib/theme-sync";

// Mounted once at the root layout; opens the SSE connection and tears it down
// on tab close. Deliberately renders nothing — style swaps happen imperatively
// via DOM access, not React render. Page-block changes trigger a React Query
// invalidate so any `trpc.page.list` consumer re-fetches.
export function ThemeSync() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const stop = startThemeSync();
    const onPageBlocks = () => {
      utils.page.list.invalidate();
    };
    window.addEventListener("page:blocks-updated", onPageBlocks);
    return () => {
      window.removeEventListener("page:blocks-updated", onPageBlocks);
      stop();
    };
  }, [utils]);

  return null;
}
