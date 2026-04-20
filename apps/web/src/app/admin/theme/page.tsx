"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc, API_URL } from "@/lib/trpc";
import { refreshThemeNow } from "@/lib/theme-sync";
import { toast } from "@/lib/toast";

// ─── Curated editable tokens ────────────────────────────────────────────
// tokens.json has hundreds of leaves; we expose the ones that matter for
// brand-level redesigns. Raw shades can still be overridden via import/export.

type EditableKind = "color" | "text";

interface EditableToken {
  path: string;
  label: string;
  kind: EditableKind;
  defaultValue: string;
  hint?: string;
}

const GROUPS: { title: string; tokens: EditableToken[] }[] = [
  {
    title: "Brand & Intents",
    tokens: [
      { path: "color.teal.500", label: "Brand", kind: "color", defaultValue: "#3ba7a7" },
      { path: "color.teal.600", label: "Brand Hover", kind: "color", defaultValue: "#2d8a8a" },
      { path: "color.teal.400", label: "Brand Glow", kind: "color", defaultValue: "#3ba7a7" },
      { path: "color.teal.700", label: "Brand Dim", kind: "color", defaultValue: "#236e6e" },
      { path: "color.red.500", label: "Danger", kind: "color", defaultValue: "#d9534f" },
      { path: "color.amber.500", label: "Warning", kind: "color", defaultValue: "#f0b429" },
      { path: "color.green.500", label: "Success", kind: "color", defaultValue: "#3fb950" },
    ],
  },
  {
    title: "Surfaces & Text",
    tokens: [
      { path: "color.neutral.900", label: "Background", kind: "color", defaultValue: "#0e1116" },
      { path: "color.neutral.800", label: "Surface", kind: "color", defaultValue: "#161b22" },
      { path: "color.neutral.700", label: "Surface raised", kind: "color", defaultValue: "#21262d" },
      { path: "color.neutral.600", label: "Surface hover", kind: "color", defaultValue: "#30363d" },
      { path: "color.neutral.100", label: "Foreground", kind: "color", defaultValue: "#e6edf3" },
      { path: "color.neutral.300", label: "Muted", kind: "color", defaultValue: "#8b949e" },
      { path: "color.neutral.400", label: "Dim", kind: "color", defaultValue: "#6e7681" },
    ],
  },
  {
    title: "Radien",
    tokens: [
      { path: "radius.sm", label: "sm", kind: "text", defaultValue: "6px" },
      { path: "radius.md", label: "md", kind: "text", defaultValue: "10px" },
      { path: "radius.lg", label: "lg", kind: "text", defaultValue: "16px" },
      { path: "radius.xl", label: "xl", kind: "text", defaultValue: "24px" },
    ],
  },
  {
    title: "Schatten",
    tokens: [
      { path: "shadow.card", label: "card", kind: "text", defaultValue: "0 4px 20px rgba(0,0,0,.35)" },
      { path: "shadow.lg", label: "lg", kind: "text", defaultValue: "0 12px 40px rgba(0,0,0,.45)" },
      { path: "shadow.glow", label: "glow", kind: "text", defaultValue: "0 0 12px var(--color-teal-500)", hint: "Darf var()-Refs enthalten." },
    ],
  },
  {
    title: "Typografie",
    tokens: [
      { path: "font.sans", label: "Sans", kind: "text", defaultValue: "'Geist', system-ui, sans-serif" },
      { path: "font.display", label: "Display", kind: "text", defaultValue: "'Geist', sans-serif" },
      { path: "font.mono", label: "Mono", kind: "text", defaultValue: "'Geist Mono', monospace" },
    ],
  },
];

interface AuditEntry {
  id: string;
  action: string;
  payload: unknown;
  createdAt: string;
  user: { handle: string; email: string } | null;
}

const LOGO_FILTERS = [
  { id: "none", label: "Kein Filter" },
  { id: "glow", label: "Glow (Teal)" },
  { id: "softGlow", label: "Soft Glow" },
  { id: "shadow", label: "Drop-Shadow" },
  { id: "duotone", label: "Duotone (Teal)" },
  { id: "mono", label: "Mono (Graustufen)" },
  { id: "brightness0", label: "Nur Schwarz" },
  { id: "invert", label: "Invertieren" },
  { id: "invertGlow", label: "Invertieren + Glow" },
  { id: "onlyWhite", label: "Nur Weiß" },
];

export default function AdminThemePage() {
  const { data: session, isPending: sessionPending } = useSession();
  const sessionUser = session?.user as
    | { id: string; role?: string }
    | undefined;
  const isAdmin = sessionUser?.role === "ADMIN";

  const utils = trpc.useUtils();
  const current = trpc.theme.get.useQuery(undefined, { enabled: isAdmin });
  const presets = trpc.theme.listPresets.useQuery(undefined, {
    enabled: isAdmin,
  });
  const revisions = trpc.theme.listRevisions.useQuery(undefined, {
    enabled: isAdmin,
  });
  const auditLog = trpc.theme.listAuditLog.useQuery(
    { limit: 20 },
    { enabled: isAdmin },
  );

  const invalidateAll = () => {
    utils.theme.get.invalidate();
    utils.theme.listAuditLog.invalidate();
    refreshThemeNow();
  };
  const onError = (err: { message: string }) => toast.error(err.message);

  const update = trpc.theme.update.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Theme aktualisiert");
    },
    onError,
  });
  const applyPreset = trpc.theme.applyPreset.useMutation({
    onSuccess: (data) => {
      invalidateAll();
      toast.success(`Preset „${data.preset}" aktiv`);
    },
    onError,
  });
  const setCustomCss = trpc.theme.setCustomCss.useMutation({
    onSuccess: () => {
      invalidateAll();
      utils.theme.listRevisions.invalidate();
      toast.success("Custom-CSS gespeichert");
    },
    onError,
  });
  const rollback = trpc.theme.rollback.useMutation({
    onSuccess: () => {
      invalidateAll();
      utils.theme.listRevisions.invalidate();
      toast.success("Revision wiederhergestellt");
    },
    onError,
  });
  const importJson = trpc.theme.importJson.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Theme-JSON importiert");
    },
    onError,
  });
  const removeLogo = trpc.theme.removeLogo.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Logo entfernt");
    },
    onError,
  });

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function onLogoFile(file: File) {
    setLogoError(null);
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Max. 2 MB");
      toast.error("Logo zu groß (max. 2 MB)");
      return;
    }
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      setLogoError("Nur PNG / JPEG / WEBP / GIF");
      toast.error("Format nicht unterstützt");
      return;
    }
    setLogoBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/theme/logo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.hint ?? body.error ?? `HTTP ${res.status}`);
      }
      invalidateAll();
      toast.success("Logo hochgeladen");
    } catch (err) {
      const msg = (err as Error).message;
      setLogoError(msg);
      toast.error(`Logo-Upload fehlgeschlagen: ${msg}`);
    } finally {
      setLogoBusy(false);
    }
  }

  // Local draft of custom-css textarea (debounced save).
  const [customDraft, setCustomDraft] = useState<string>("");
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (current.data) setCustomDraft(current.data.customCss ?? "");
  }, [current.data?.customCss]);

  const overrideMap = current.data?.tokensOverride ?? {};

  const onTokenChange = (path: string, value: string | null) => {
    update.mutate({ tokensOverride: { [path]: value } });
  };

  const onResetAll = () => {
    const cleared: Record<string, null> = {};
    for (const p of Object.keys(overrideMap)) cleared[p] = null;
    if (Object.keys(cleared).length === 0) return;
    update.mutate({ tokensOverride: cleared, logoFilter: null });
  };

  const onExport = async () => {
    const data = await utils.theme.exportJson.fetch();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itsweber-play-theme-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const onImportFile = async (file: File) => {
    const txt = await file.text();
    try {
      const parsed = JSON.parse(txt);
      importJson.mutate(parsed);
    } catch (err) {
      alert(`Import fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  const onSaveCustomCss = () => {
    setCustomError(null);
    setCustomCss.mutate(
      { customCss: customDraft.trim() ? customDraft : null },
      {
        onError: (err) => setCustomError(err.message),
      },
    );
  };

  const logoFilterValue = current.data?.logoFilter ?? "";

  // ─── Gates ──────────────────────────────────────────────────────────
  if (sessionPending) return <p className="text-muted">Lädt …</p>;
  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Theme-Editor</h1>
        <Link href="/login" className="text-brand hover:underline">
          Anmelden
        </Link>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Kein Zugriff</h1>
        <p className="text-muted">Nur für Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">
            Theme-Editor
          </h1>
          <p className="mt-1 text-sm text-muted">
            Live-Änderungen. Jedes Edit persistiert + pusht per SSE an alle
            offenen Tabs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onResetAll}
            disabled={Object.keys(overrideMap).length === 0}
            className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface disabled:opacity-40"
          >
            Alle Overrides zurücksetzen
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr_360px]">
        {/* ─── LEFT: Token Editor ──────────────────────────── */}
        <aside className="space-y-3">
          {GROUPS.map((g) => (
            <TokenGroup
              key={g.title}
              title={g.title}
              tokens={g.tokens}
              overrideMap={overrideMap}
              onChange={onTokenChange}
            />
          ))}

          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Logo-Filter
            </h3>
            <div className="p-3">
              <select
                aria-label="Logo-Filter"
                value={logoFilterValue}
                onChange={(e) =>
                  update.mutate({
                    logoFilter: e.target.value || null,
                  })
                }
                className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">— Kein Override —</option>
                {LOGO_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Logo
            </h3>
            <div className="flex flex-col gap-3 p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-border bg-background">
                  {current.data?.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={current.data.logoUrl}
                      alt="Aktuelles Logo"
                      className="h-10 w-10 object-contain [filter:var(--logo-filter)]"
                    />
                  ) : (
                    <span className="mono text-[10px] text-dim">Default</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="text-muted">
                    {current.data?.logoUrl
                      ? "Admin-Upload aktiv"
                      : "ITSWEBER-Default-Logo"}
                  </p>
                  <p className="mono text-[10px] text-dim">
                    PNG / JPEG / WEBP / GIF, max. 2 MB
                  </p>
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Logo-Datei auswählen"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onLogoFile(f);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoBusy}
                  className="flex-1 rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-medium transition hover:bg-surface-hover disabled:opacity-60"
                >
                  {logoBusy ? "Lädt …" : "Logo hochladen"}
                </button>
                {current.data?.logoUrl && (
                  <button
                    type="button"
                    onClick={() => removeLogo.mutate()}
                    disabled={removeLogo.isPending}
                    className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-raised disabled:opacity-60"
                  >
                    Entfernen
                  </button>
                )}
              </div>
              {logoError && (
                <p className="text-xs text-danger">{logoError}</p>
              )}
            </div>
          </section>
        </aside>

        {/* ─── CENTER: Preview ─────────────────────────────── */}
        <section className="min-h-[70vh] overflow-hidden rounded-2xl border border-border-strong bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-muted">
              Live-Preview
            </span>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand hover:underline"
            >
              Neuer Tab →
            </a>
          </div>
          <iframe
            src="/"
            title="Live Preview"
            className="h-[min(72vh,900px)] w-full border-0 bg-background"
          />
        </section>

        {/* ─── RIGHT: Presets / CSS / I-O ──────────────────── */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Presets
            </h3>
            <div className="space-y-1.5 p-3">
              {presets.data?.map((p) => {
                const active = current.data?.activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset.mutate({ presetId: p.id })}
                    className={
                      "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition " +
                      (active
                        ? "border-brand bg-brand/10"
                        : "border-border bg-surface-raised hover:border-border-strong")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {p.name}
                        </span>
                        {active && (
                          <span className="mono rounded bg-brand/20 px-1.5 py-0.5 text-[10px] text-brand">
                            AKTIV
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{p.description}</p>
                    </div>
                  </button>
                );
              })}
              {presets.isPending && (
                <p className="text-xs text-muted">Lädt …</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Export / Import
            </h3>
            <div className="flex flex-col gap-2 p-3">
              <button
                type="button"
                onClick={onExport}
                className="rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium transition hover:bg-surface-hover"
              >
                JSON exportieren
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                aria-label="Theme-JSON importieren"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium transition hover:bg-surface-hover"
              >
                JSON importieren …
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Custom CSS
            </h3>
            <div className="space-y-2 p-3">
              <textarea
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                spellCheck={false}
                placeholder=".video-card:hover { transform: scale(1.02); }"
                className="mono h-36 w-full resize-y rounded-md border border-border bg-background p-2 text-xs text-foreground outline-none focus:border-brand"
              />
              {customError && (
                <p className="text-xs text-danger">{customError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSaveCustomCss}
                  disabled={setCustomCss.isPending}
                  className="flex-1 rounded-md bg-brand px-3 py-2 text-xs font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60"
                >
                  Speichern + Deploy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomDraft("");
                    setCustomCss.mutate({ customCss: null });
                  }}
                  className="rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-muted hover:bg-surface-raised"
                >
                  Leeren
                </button>
              </div>

              <details className="pt-2">
                <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                  CSS-Revisionen ({revisions.data?.length ?? 0})
                </summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {revisions.data?.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-surface-raised px-2 py-1"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="mono text-dim">
                          {new Date(r.createdAt).toLocaleString("de-DE")}
                        </span>
                        <div className="mono truncate text-[10px] text-muted">
                          {r.preview ?? "(leer)"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => rollback.mutate({ revisionId: r.id })}
                        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-brand hover:bg-surface"
                      >
                        Rollback
                      </button>
                    </li>
                  ))}
                  {revisions.data?.length === 0 && (
                    <li className="text-[11px] text-dim">Noch keine Revisionen.</li>
                  )}
                </ul>
              </details>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Audit-Log
            </h3>
            <ul className="space-y-1 p-3 text-xs">
              {(auditLog.data as AuditEntry[] | undefined)?.map((e) => (
                <li
                  key={e.id}
                  className="rounded border border-border bg-surface-raised px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-brand">{e.action}</span>
                    <span className="mono text-[10px] text-dim">
                      {new Date(e.createdAt).toLocaleString("de-DE")}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted">
                      {e.user ? `@${e.user.handle}` : "—"}
                    </span>
                    <span className="mono truncate text-[10px] text-dim">
                      {summarizePayload(e.action, e.payload)}
                    </span>
                  </div>
                </li>
              ))}
              {auditLog.data?.length === 0 && (
                <li className="text-[11px] text-dim">Noch keine Einträge.</li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function summarizePayload(action: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  if (action === "applyPreset") return String(p.presetName ?? p.presetId ?? "");
  if (action === "update") {
    const patch = p.patch as Record<string, unknown> | undefined;
    if (!patch) return "";
    const keys = Object.keys(patch);
    return keys.length <= 2 ? keys.join(", ") : `${keys.length} Token`;
  }
  if (action === "setCustomCss") return p.cleared ? "leer" : `${p.length}B`;
  if (action === "rollback") return `rev ${String(p.revisionId).slice(-6)}`;
  if (action === "importJson") return `${p.tokenKeys ?? 0} Token`;
  return "";
}

// ─── Sub-component: Group ────────────────────────────────────────────────
function TokenGroup({
  title,
  tokens,
  overrideMap,
  onChange,
}: {
  title: string;
  tokens: EditableToken[];
  overrideMap: Record<string, string>;
  onChange: (path: string, value: string | null) => void;
}) {
  const hasOverride = useMemo(
    () => tokens.some((t) => overrideMap[t.path] != null),
    [tokens, overrideMap],
  );

  return (
    <details open className="rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer items-center justify-between border-b border-transparent px-3 py-2 text-sm font-medium text-foreground [&[open]]:border-border">
        <span>{title}</span>
        {hasOverride && (
          <span className="mono rounded bg-brand/15 px-1.5 py-0.5 text-[10px] text-brand">
            geändert
          </span>
        )}
      </summary>
      <div className="space-y-2 p-3">
        {tokens.map((t) => (
          <TokenRow
            key={t.path}
            token={t}
            overrideValue={overrideMap[t.path] ?? null}
            onChange={onChange}
          />
        ))}
      </div>
    </details>
  );
}

function TokenRow({
  token,
  overrideValue,
  onChange,
}: {
  token: EditableToken;
  overrideValue: string | null;
  onChange: (path: string, value: string | null) => void;
}) {
  const current = overrideValue ?? token.defaultValue;
  const [draft, setDraft] = useState(current);

  // Keep draft synced when server-side value changes (e.g. preset switch).
  useEffect(() => {
    setDraft(current);
  }, [current]);

  const commit = (v: string) => {
    if (!v || v === token.defaultValue) onChange(token.path, null);
    else onChange(token.path, v);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 text-xs">
        <span className="block text-muted">{token.label}</span>
        <span className="mono block text-[10px] text-dim">{token.path}</span>
      </label>
      {token.kind === "color" ? (
        <input
          type="color"
          aria-label={`${token.label} Farbwähler`}
          value={isValidHex(draft) ? draft : token.defaultValue}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-border bg-surface"
        />
      ) : null}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="mono w-32 shrink-0 rounded border border-border bg-surface-raised px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-brand"
        title={token.hint}
      />
      {overrideValue != null && (
        <button
          type="button"
          onClick={() => onChange(token.path, null)}
          aria-label="Zurücksetzen"
          className="text-dim hover:text-danger"
          title="Zurücksetzen"
        >
          ×
        </button>
      )}
    </div>
  );
}

function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(v);
}
