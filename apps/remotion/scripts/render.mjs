#!/usr/bin/env node
/**
 * Renders all 4 demo-video compositions to apps/remotion/out/.
 * Run: node scripts/render.mjs [--composition WelcomeLong]
 *
 * Requires: pnpm install in this package first.
 * Output: out/WelcomeLong.mp4, out/StudioTourLong.mp4,
 *         out/ShortsFeatureShort.mp4, out/AccessibilityShort.mp4
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.join(ROOT, "src", "index.ts");
const OUT_DIR = path.join(ROOT, "out");

const ALL_COMPOSITIONS = [
  "WelcomeLong",
  "StudioTourLong",
  "ShortsFeatureShort",
  "AccessibilityShort",
];

const targetArg = process.argv.find((a, i) => process.argv[i - 1] === "--composition");
const targets = targetArg ? [targetArg] : ALL_COMPOSITIONS;

await mkdir(OUT_DIR, { recursive: true });

console.log("[render] Bundling Remotion entry…");
const bundled = await bundle({ entryPoint: ENTRY });

for (const id of targets) {
  console.log(`[render] Selecting composition: ${id}`);
  const comp = await selectComposition({ serveUrl: bundled, id });

  const out = path.join(OUT_DIR, `${id}.mp4`);
  console.log(`[render] Rendering ${id} → ${out}`);
  await renderMedia({
    composition: comp,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: out,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  ${Math.round(progress * 100)}%`);
    },
  });
  process.stdout.write("\n");
  console.log(`[render] Done: ${out}`);
}

console.log("[render] All compositions rendered.");
