// Runtime preset loader — used by apps/api (`theme.applyPreset`) and by the
// admin editor UI (`theme.listPresets`). Reads the JSON files from disk at
// request time; filesystem is the source of truth so designers can drop in
// new presets without a code change.

import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PRESET_DIR = resolve(here, "..", "presets");

export interface ThemePreset {
  name: string;
  description: string;
  overrides: Record<string, string>;
  logoFilter?: string;
}

export interface ThemePresetSummary {
  id: string;
  name: string;
  description: string;
}

// Defense against path-traversal: only lowercase letters, numbers, dashes.
const PRESET_ID_RE = /^[a-z0-9-]+$/;

export async function loadPreset(id: string): Promise<ThemePreset> {
  if (!PRESET_ID_RE.test(id)) {
    throw new Error(`Invalid preset id: ${id}`);
  }
  const raw = await readFile(resolve(PRESET_DIR, `${id}.json`), "utf8");
  return JSON.parse(raw) as ThemePreset;
}

export async function listPresets(): Promise<ThemePresetSummary[]> {
  const entries = await readdir(PRESET_DIR);
  const ids = entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length));

  const results = await Promise.all(
    ids.map(async (id) => {
      const preset = await loadPreset(id);
      return {
        id,
        name: preset.name,
        description: preset.description,
      } satisfies ThemePresetSummary;
    }),
  );
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
