// Rastert apps/web/src/app/icon.svg in die PWA-/iOS-/Fallback-Formate:
//
//   public/favicon.ico         — 32×32 (Browser-Tab-Fallback, Legacy)
//   public/icon-192.png        — 192×192 (PWA-Manifest)
//   public/icon-512.png        — 512×512 (PWA-Manifest, Android-Home-Screen)
//   public/apple-touch-icon.png — 180×180 (iOS-Homescreen-Icon)
//
// Next liest zusätzlich automatisch `src/app/icon.svg` als Tab-Icon; der
// `favicon.ico`-Fallback hier ist für alte Browser und als E-Mail-Signaturen-
// Referenz.
//
// Ausführung: `node scripts/build-favicons.mjs` aus apps/web/.

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SVG = resolve(ROOT, "../src/app/icon.svg");
const OUT = resolve(ROOT, "../public");

const svgBuffer = await readFile(SVG);

const targets = [
  { name: "favicon.ico", size: 32 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of targets) {
  const pipeline = sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: "contain", background: { r: 10, g: 26, b: 38, alpha: 1 } })
    .png();
  const buf = await pipeline.toBuffer();
  await writeFile(resolve(OUT, name), buf);
  console.log(`[favicons] ${name} (${size}×${size}, ${buf.length} bytes)`);
}
