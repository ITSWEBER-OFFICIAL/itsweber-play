// Generates dist/primitives.css from tokens.json as a Tailwind v4 `@theme` block.
// Primitive tokens become CSS custom properties AND Tailwind utilities
// (e.g. --color-teal-500 → bg-teal-500, --radius-md → rounded-md).
// Runs on postinstall and via `pnpm --filter @play/theme build`.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");

const raw = await readFile(resolve(pkgRoot, "tokens.json"), "utf8");
const tokens = JSON.parse(raw);

// Meta keys in tokens.json that shouldn't become CSS vars.
const META = new Set(["$schema", "description"]);

// Map token-group name → CSS-var prefix. Everything else falls back to the
// kebab-cased group name.
const GROUP_PREFIX = {
  color: "color",
  font: "font",
  fontSize: "font-size",
  radius: "radius",
  spacing: "spacing",
  shadow: "shadow",
  logoFilter: "logo-filter",
  transition: "transition",
};

function walk(node, pathParts, out) {
  if (node == null) return;
  if (typeof node === "string" || typeof node === "number") {
    out.push([pathParts.join("-"), String(node)]);
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      walk(v, [...pathParts, k], out);
    }
  }
}

const lines = [
  "/* Auto-generated from packages/theme/tokens.json — do not edit. */",
  "/* Primitives (Ebene 1) — exposed to Tailwind v4 via @theme. */",
  "@theme {",
];

for (const [groupKey, group] of Object.entries(tokens)) {
  if (META.has(groupKey)) continue;
  const prefix = GROUP_PREFIX[groupKey] ?? groupKey;
  const flat = [];
  walk(group, [prefix], flat);
  if (flat.length === 0) continue;
  lines.push(`  /* ${groupKey} */`);
  for (const [name, value] of flat) {
    lines.push(`  --${name}: ${value};`);
  }
}

lines.push("}", "");

const distDir = resolve(pkgRoot, "dist");
await mkdir(distDir, { recursive: true });
const outPath = resolve(distDir, "primitives.css");
await writeFile(outPath, lines.join("\n"), "utf8");
console.log(`[@play/theme] wrote ${outPath}`);
