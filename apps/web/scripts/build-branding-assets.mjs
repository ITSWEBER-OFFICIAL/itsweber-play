// Rastert alle SVG-Brand-Assets aus /assets/logo/ zu PNG in den richtigen Größen.
// Ausführung: `node apps/web/scripts/build-branding-assets.mjs`

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const SRC = resolve(ROOT, "assets/logo");
const PUBLIC = resolve(ROOT, "apps/web/public");
const ASSET_OUT = resolve(ROOT, "assets/logo/exports");

await mkdir(ASSET_OUT, { recursive: true });

const iconSvg = await readFile(resolve(SRC, "icon-transparent.svg"));
const wordmarkSvg = await readFile(resolve(SRC, "wordmark-horizontal.svg"));
const bannerSvg = await readFile(resolve(SRC, "social-banner.svg"));
const ogSvg = await readFile(resolve(SRC, "og-default.svg"));

// Navy-Hintergrund für bestimmte Favicon-Targets (wo Transparenz nicht gut aussieht).
const NAVY = { r: 10, g: 26, b: 38, alpha: 1 };

async function pngTransparent(svg, size, outPath) {
  const buf = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(outPath, buf);
  console.log(`  ✓ ${outPath}  (${size}×${size}, ${buf.length} bytes)`);
}

async function pngNavy(svg, size, outPath) {
  const buf = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: NAVY })
    .png()
    .toBuffer();
  await writeFile(outPath, buf);
  console.log(`  ✓ ${outPath}  (${size}×${size}, ${buf.length} bytes)`);
}

async function pngAspect(svg, width, height, outPath) {
  const buf = await sharp(svg, { density: 384 })
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(outPath, buf);
  console.log(`  ✓ ${outPath}  (${width}×${height}, ${buf.length} bytes)`);
}

console.log("[brand] Rendering icon (transparent, multiple sizes)…");
await pngTransparent(iconSvg, 1024, resolve(ASSET_OUT, "icon-1024.png"));
await pngTransparent(iconSvg, 512, resolve(ASSET_OUT, "icon-512-transparent.png"));
await pngTransparent(iconSvg, 256, resolve(ASSET_OUT, "icon-256-transparent.png"));
await pngTransparent(iconSvg, 128, resolve(ASSET_OUT, "icon-128-transparent.png"));

console.log("[brand] Rendering PWA/Favicon targets (navy background, rounded)…");
await pngNavy(iconSvg, 512, resolve(PUBLIC, "icon-512.png"));
await pngNavy(iconSvg, 192, resolve(PUBLIC, "icon-192.png"));
await pngNavy(iconSvg, 180, resolve(PUBLIC, "apple-touch-icon.png"));
await pngNavy(iconSvg, 32, resolve(PUBLIC, "favicon.ico"));

console.log("[brand] Rendering wordmark horizontal…");
await pngAspect(wordmarkSvg, 800, 200, resolve(ASSET_OUT, "wordmark-800.png"));
await pngAspect(wordmarkSvg, 1600, 400, resolve(ASSET_OUT, "wordmark-1600.png"));

console.log("[brand] Rendering social banner (GitHub cover, ads)…");
await pngAspect(bannerSvg, 1280, 640, resolve(ASSET_OUT, "social-banner-1280.png"));
await pngAspect(bannerSvg, 2560, 1280, resolve(ASSET_OUT, "social-banner-2560.png"));

console.log("[brand] Rendering OG default for Next metadata…");
await pngAspect(ogSvg, 1200, 630, resolve(PUBLIC, "og-default.png"));

console.log("\n[brand] Done.");
console.log(`  Web-public:  ${PUBLIC}`);
console.log(`  Asset-bank:  ${ASSET_OUT}`);
