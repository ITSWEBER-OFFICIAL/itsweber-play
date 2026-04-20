// Converts the admin's dot-notation overrides (`color.teal.500`, `shadow.card`,
// `logoFilter`) into a CSS `:root { … }` block that goes into <style id="theme-vars">.
// Path syntax must match what `scripts/build-primitives-css.mjs` produces so
// an override like `color.neutral.900` lands on the same CSS var as the default.

import tokens from "../tokens.json";

// Keep in sync with scripts/build-primitives-css.mjs → GROUP_PREFIX.
const GROUP_PREFIX: Record<string, string> = {
  color: "color",
  font: "font",
  fontSize: "font-size",
  radius: "radius",
  spacing: "spacing",
  shadow: "shadow",
  logoFilter: "logo-filter",
  transition: "transition",
};

export function tokenPathToCssVar(path: string): string {
  const parts = path.split(".");
  const group = parts[0];
  if (!group) throw new Error(`Empty token path`);
  const prefix = GROUP_PREFIX[group] ?? group;
  return `--${[prefix, ...parts.slice(1)].join("-")}`;
}

// ─── Value sanitation ───────────────────────────────────────────────────
// Token VALUES land inside `:root { --x: <value>; }`. They can legitimately
// contain parens (var(), rgba(), color-mix()), commas, spaces — so we can't
// strictly whitelist. We reject values containing `;` or newlines (which would
// let an override escape its declaration) and `<`/`</style>` (defense in depth
// even though values are injected into a TextNode-equivalent in SSR).
const DANGEROUS_VALUE = /[;{}<>]|<\/style>/i;

function assertSafeValue(value: string) {
  if (DANGEROUS_VALUE.test(value)) {
    throw new Error(`Unsafe token value: ${value}`);
  }
}

const DANGEROUS_PATH = /[^a-zA-Z0-9._-]/;
function assertSafePath(path: string) {
  if (DANGEROUS_PATH.test(path)) {
    throw new Error(`Unsafe token path: ${path}`);
  }
}

export interface OverrideInput {
  tokensOverride?: Record<string, unknown> | null;
  logoFilter?: string | null;
}

// Builds the `:root { … }` block. Returns empty string if no overrides apply.
// `logoFilter` is a named reference (e.g. "glow") resolving to `var(--logo-filter-glow)`.
export function overridesToCssBlock(input: OverrideInput): string {
  const decls: string[] = [];

  if (input.tokensOverride) {
    for (const [path, rawValue] of Object.entries(input.tokensOverride)) {
      if (rawValue == null) continue;
      const value = String(rawValue);
      assertSafePath(path);
      assertSafeValue(value);
      decls.push(`  ${tokenPathToCssVar(path)}: ${value};`);
    }
  }

  if (input.logoFilter) {
    const name = String(input.logoFilter);
    if (/^[a-zA-Z0-9_-]+$/.test(name)) {
      // Resolve the named filter to its literal value from tokens.json and
      // inline that — going through `var(--logo-filter-<name>)` would be
      // prettier, but it depends on primitives.css being rebuilt whenever
      // a new name is added. Inlining is self-contained and dev-HMR-safe.
      const filterMap = (tokens as { logoFilter?: Record<string, string> })
        .logoFilter;
      const resolved = filterMap?.[name];
      if (resolved) {
        assertSafeValue(resolved);
        decls.push(`  --logo-filter: ${resolved};`);
      }
    }
  }

  if (decls.length === 0) return "";
  return `:root {\n${decls.join("\n")}\n}`;
}
