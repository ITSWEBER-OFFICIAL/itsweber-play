// Semantic token map — mirrors styles/semantic.css for JS-side consumers
// (e.g. upcoming admin theme editor, SSR <style> generator).
// Values are CSS `var()` refs to primitives so cascade overrides still work.

export const semantic = {
  bg: {
    base: "var(--color-neutral-900)",
    surface: "var(--color-neutral-800)",
    surfaceRaised: "var(--color-neutral-700)",
  },
  border: {
    default: "var(--color-neutral-700)",
  },
  fg: {
    primary: "var(--color-neutral-50)",
    muted: "var(--color-neutral-400)",
    subtle: "var(--color-neutral-300)",
  },
  brand: {
    default: "var(--color-teal-500)",
    hover: "var(--color-teal-600)",
  },
  intent: {
    danger: "var(--color-red-500)",
    warning: "var(--color-amber-500)",
    success: "var(--color-green-500)",
  },
} as const;

export type Semantic = typeof semantic;
