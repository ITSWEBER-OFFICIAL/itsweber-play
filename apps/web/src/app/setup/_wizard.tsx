"use client";

// First-Run-Setup-Wizard (Session M).
//
// Single-File-Component mit allen 9 Steps; State lebt komplett im Komponenten-
// Scope. Submit ruft `setup.complete` (publicProcedure) — damit wird sowohl
// der Admin angelegt (über Better-Auth) als auch SiteSettings/Theme/SMTP
// in einem Schritt persistiert.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { trpc, API_URL } from "@/lib/trpc";

type RegistrationMode = "OPEN" | "INVITE" | "CLOSED";
type Locale = "de" | "en";

type SmtpDraft = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromAddress: string;
};

type FormState = {
  locale: Locale;
  siteName: string;
  siteTagline: string;
  contactEmail: string;
  logoKey: string | null;
  adminDisplayName: string;
  adminEmail: string;
  adminHandle: string;
  adminPassword: string;
  smtpEnabled: boolean;
  smtp: SmtpDraft;
  themePresetId: string | null;
  registrationMode: RegistrationMode;
  storageAcknowledged: boolean;
};

const STEPS = [
  { id: 1, label: "Sprache" },
  { id: 2, label: "Site-Name" },
  { id: 3, label: "Branding" },
  { id: 4, label: "Admin-Account" },
  { id: 5, label: "E-Mail (SMTP)" },
  { id: 6, label: "Theme" },
  { id: 7, label: "Registrierung" },
  { id: 8, label: "Storage" },
  { id: 9, label: "Fertig" },
];

const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;

const INITIAL: FormState = {
  locale: "de",
  siteName: "ITSWEBER Play",
  siteTagline: "Die Plattform für eigene Stimmen.",
  contactEmail: "",
  logoKey: null,
  adminDisplayName: "",
  adminEmail: "",
  adminHandle: "",
  adminPassword: "",
  smtpEnabled: false,
  smtp: {
    host: "",
    port: 587,
    secure: false,
    user: "",
    password: "",
    fromName: "ITSWEBER Play",
    fromAddress: "",
  },
  themePresetId: null,
  registrationMode: "OPEN",
  storageAcknowledged: false,
};

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const status = trpc.setup.status.useQuery();
  const presets = trpc.setup.listThemePresets.useQuery();
  const testSmtp = trpc.setup.testSmtp.useMutation();
  const complete = trpc.setup.complete.useMutation();

  // Wenn der Wizard schon durchlief (anderer Tab, Race), schick den User raus.
  useEffect(() => {
    if (status.data?.completed) router.replace("/admin");
  }, [status.data?.completed, router]);

  // INITIAL_ADMIN_EMAIL aus dem ENV vorbefüllen, sobald der Status geladen ist.
  useEffect(() => {
    if (status.data?.initialAdminEmail && !form.adminEmail) {
      setForm((f) => ({ ...f, adminEmail: status.data!.initialAdminEmail! }));
    }
    // form.adminEmail bewusst nicht in Deps — sonst klobbern wir User-Edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data?.initialAdminEmail]);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function patchSmtp(p: Partial<SmtpDraft>) {
    setForm((f) => ({ ...f, smtp: { ...f.smtp, ...p } }));
  }

  function next() {
    setStep((s) => Math.min(STEPS.length, s + 1));
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  const stepValid = useMemo(() => validate(form, step), [form, step]);

  async function handleSubmit() {
    setSubmitError(null);
    try {
      await complete.mutateAsync({
        site: {
          siteName: form.siteName.trim(),
          siteTagline: form.siteTagline.trim(),
          contactEmail: form.contactEmail.trim(),
          defaultLocale: form.locale,
          registrationMode: form.registrationMode,
        },
        admin: {
          email: form.adminEmail.trim(),
          handle: form.adminHandle.trim(),
          displayName: form.adminDisplayName.trim(),
          password: form.adminPassword,
        },
        themePresetId: form.themePresetId,
        smtp: form.smtpEnabled
          ? {
              ...form.smtp,
              host: form.smtp.host.trim(),
              user: form.smtp.user.trim(),
              fromName: form.smtp.fromName.trim(),
              fromAddress: form.smtp.fromAddress.trim(),
            }
          : null,
      });
      // Admin direkt einloggen, damit der Redirect nach /admin nicht beim
      // AdminGate hängenbleibt.
      await signIn.email({
        email: form.adminEmail.trim(),
        password: form.adminPassword,
      });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Setup-Abschluss fehlgeschlagen.",
      );
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10 lg:flex-row lg:py-16">
        <Sidebar step={step} onJump={(n) => n < step && setStep(n)} />

        <main className="flex-1 space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Schritt {step} von {STEPS.length}
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {STEPS[step - 1]?.label}
            </h1>
          </header>

          <section className="rounded-xl border border-border bg-surface p-6">
            {step === 1 && <StepLanguage value={form.locale} onChange={(locale) => patch({ locale })} />}
            {step === 2 && (
              <StepSite
                siteName={form.siteName}
                siteTagline={form.siteTagline}
                contactEmail={form.contactEmail}
                onChange={patch}
              />
            )}
            {step === 3 && (
              <StepBranding
                logoKey={form.logoKey}
                onUploaded={(logoKey) => patch({ logoKey })}
              />
            )}
            {step === 4 && (
              <StepAdmin
                displayName={form.adminDisplayName}
                email={form.adminEmail}
                handle={form.adminHandle}
                password={form.adminPassword}
                emailLocked={Boolean(status.data?.initialAdminEmail) && form.adminEmail === status.data?.initialAdminEmail}
                onChange={patch}
              />
            )}
            {step === 5 && (
              <StepSmtp
                enabled={form.smtpEnabled}
                smtp={form.smtp}
                onToggle={(smtpEnabled) => patch({ smtpEnabled })}
                onChange={patchSmtp}
                onTest={async () => {
                  const res = await testSmtp.mutateAsync({
                    host: form.smtp.host.trim(),
                    port: form.smtp.port,
                    secure: form.smtp.secure,
                    user: form.smtp.user.trim(),
                    password: form.smtp.password,
                  });
                  return res;
                }}
                testing={testSmtp.isPending}
              />
            )}
            {step === 6 && (
              <StepTheme
                presets={presets.data ?? []}
                value={form.themePresetId}
                loading={presets.isPending}
                onChange={(themePresetId) => patch({ themePresetId })}
              />
            )}
            {step === 7 && (
              <StepRegistration
                value={form.registrationMode}
                onChange={(registrationMode) => patch({ registrationMode })}
              />
            )}
            {step === 8 && (
              <StepStorage
                acknowledged={form.storageAcknowledged}
                onChange={(storageAcknowledged) => patch({ storageAcknowledged })}
              />
            )}
            {step === 9 && (
              <StepFinish form={form} error={submitError} pending={complete.isPending} />
            )}
          </section>

          <footer className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={prev}
              disabled={step === 1}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-border-strong disabled:opacity-40"
            >
              Zurück
            </button>
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={next}
                disabled={!stepValid}
                className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand-hover disabled:opacity-50"
              >
                Weiter
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!stepValid || complete.isPending}
                className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand-hover disabled:opacity-50"
              >
                {complete.isPending ? "Setup läuft …" : "Setup abschließen"}
              </button>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

// ─── Stepper-Sidebar ──────────────────────────────────────────────────────

function Sidebar({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <aside className="lg:w-64 lg:flex-shrink-0">
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          ITSWEBER Play
        </p>
        <h2 className="mt-1 text-lg font-bold">Erst-Einrichtung</h2>
        <p className="mt-2 text-xs text-muted">
          Diese Schritte einmalig ausfüllen, um die Plattform freizuschalten.
        </p>
        <ol className="mt-5 space-y-1.5">
          {STEPS.map((s) => {
            const done = s.id < step;
            const active = s.id === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onJump(s.id)}
                  className={
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition " +
                    (active
                      ? "bg-brand/10 text-foreground"
                      : done
                        ? "text-muted hover:bg-surface-raised"
                        : "text-dim")
                  }
                >
                  <span
                    className={
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
                      (active
                        ? "bg-brand text-neutral-900"
                        : done
                          ? "bg-brand/20 text-brand"
                          : "bg-surface-raised text-dim")
                    }
                  >
                    {done ? "✓" : s.id}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

// ─── Step-Komponenten ─────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{children}</span>
      {hint && <p className="text-xs text-dim">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  pattern,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  pattern?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      pattern={pattern}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
    />
  );
}

function StepLanguage({
  value,
  onChange,
}: {
  value: Locale;
  onChange: (v: Locale) => void;
}) {
  const opts: { id: Locale; label: string; desc: string }[] = [
    { id: "de", label: "Deutsch", desc: "Standard-Sprache der Oberfläche." },
    { id: "en", label: "English", desc: "Frontend-i18n folgt in v0.4 — Backend-Mails sind aktuell noch DE." },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Wähle die primäre Sprache. Du kannst sie später unter Einstellungen ändern.
      </p>
      {opts.map((o) => (
        <label
          key={o.id}
          className={
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition " +
            (value === o.id
              ? "border-brand bg-brand/5"
              : "border-border hover:border-border-strong")
          }
        >
          <input
            type="radio"
            name="locale"
            checked={value === o.id}
            onChange={() => onChange(o.id)}
            className="mt-0.5 accent-brand"
          />
          <div>
            <p className="text-sm font-semibold">{o.label}</p>
            <p className="text-xs text-muted">{o.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

function StepSite({
  siteName,
  siteTagline,
  contactEmail,
  onChange,
}: {
  siteName: string;
  siteTagline: string;
  contactEmail: string;
  onChange: (p: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Diese Texte erscheinen im Header, im Footer und als Browser-Tab-Titel.
      </p>
      <label className="block space-y-1.5">
        <FieldLabel>Site-Name</FieldLabel>
        <TextInput value={siteName} onChange={(v) => onChange({ siteName: v })} placeholder="z. B. ITSWEBER Play" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>Tagline</FieldLabel>
        <TextInput value={siteTagline} onChange={(v) => onChange({ siteTagline: v })} placeholder="Kurze Mission in einem Satz." />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel hint="Wird im Footer + auf Impressum-Stub hinterlegt. Kann leer bleiben.">
          Kontakt-E-Mail (optional)
        </FieldLabel>
        <TextInput type="email" value={contactEmail} onChange={(v) => onChange({ contactEmail: v })} placeholder="kontakt@example.com" />
      </label>
    </div>
  );
}

function StepBranding({
  logoKey,
  onUploaded,
}: {
  logoKey: string | null;
  onUploaded: (key: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/api/setup/logo`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; hint?: string } | null;
        throw new Error(body?.hint ?? body?.error ?? `Upload-Fehler ${res.status}`);
      }
      const body = (await res.json()) as { key: string };
      onUploaded(body.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Logo (PNG / JPEG / WEBP / GIF, max. 2 MB) — optional. SVG ist bewusst
        deaktiviert (XSS-Schutz). Favicons werden weiterhin aus
        <code className="mx-1 rounded bg-surface-raised px-1 py-0.5 mono text-xs">apps/web/public/favicon.ico</code>
        ausgeliefert; ein UI-Upload kommt in v0.4.
      </p>

      <label className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-raised p-8 text-center">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <span className="text-sm font-medium text-foreground">
          {uploading ? "Upload läuft …" : logoKey ? "Logo gesetzt — anderes wählen" : "Logo auswählen"}
        </span>
        <span className="text-xs text-muted">Klicken oder Datei reinziehen</span>
      </label>

      {logoKey && (
        <p className="mono rounded-md border border-border bg-surface-raised px-3 py-2 text-xs text-muted">
          {logoKey}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-dim">
        Dieser Schritt ist optional — du kannst ihn überspringen und später unter
        <code className="mx-1 rounded bg-surface-raised px-1 py-0.5 mono text-xs">/admin/theme</code>
        nachholen.
      </p>
    </div>
  );
}

function StepAdmin({
  displayName,
  email,
  handle,
  password,
  emailLocked,
  onChange,
}: {
  displayName: string;
  email: string;
  handle: string;
  password: string;
  emailLocked: boolean;
  onChange: (p: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Erster Account dieser Plattform. Bekommt automatisch die ADMIN-Rolle und
        einen leeren Default-Channel mit dem unten gewählten Handle.
      </p>
      <label className="block space-y-1.5">
        <FieldLabel>Anzeigename</FieldLabel>
        <TextInput
          value={displayName}
          onChange={(v) => onChange({ adminDisplayName: v })}
          placeholder="Max Mustermann"
        />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel hint="3–30 Zeichen, nur a-z, 0-9, _ und -. Wird als @handle und URL-Slug verwendet.">
          Handle
        </FieldLabel>
        <TextInput
          value={handle}
          onChange={(v) => onChange({ adminHandle: v.toLowerCase() })}
          pattern="[a-z0-9_-]{3,30}"
          placeholder="dein-handle"
        />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel hint={emailLocked ? "Aus INITIAL_ADMIN_EMAIL übernommen — bewusst gelocked." : undefined}>
          E-Mail
        </FieldLabel>
        <input
          type="email"
          value={email}
          autoComplete="email"
          readOnly={emailLocked}
          onChange={(e) => onChange({ adminEmail: e.target.value })}
          placeholder="admin@example.com"
          className={
            "w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand " +
            (emailLocked ? "border-brand/50 bg-surface-raised text-muted" : "border-border")
          }
        />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel hint="Mindestens 10 Zeichen. Wird gehasht (Better-Auth Argon2).">Passwort</FieldLabel>
        <TextInput
          type="password"
          value={password}
          onChange={(v) => onChange({ adminPassword: v })}
          autoComplete="new-password"
        />
      </label>
    </div>
  );
}

function StepSmtp({
  enabled,
  smtp,
  onToggle,
  onChange,
  onTest,
  testing,
}: {
  enabled: boolean;
  smtp: SmtpDraft;
  onToggle: (v: boolean) => void;
  onChange: (p: Partial<SmtpDraft>) => void;
  onTest: () => Promise<{ ok: true } | { ok: false; error: string }>;
  testing: boolean;
}) {
  const [testResult, setTestResult] = useState<string | null>(null);

  async function runTest() {
    setTestResult(null);
    try {
      const res = await onTest();
      setTestResult(res.ok ? "ok" : `error: ${res.error}`);
    } catch (err) {
      setTestResult(err instanceof Error ? `error: ${err.message}` : "error: unbekannt");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Optional. Ohne SMTP werden Verifikations- und Notification-Mails ins
        Server-Log geschrieben — du kannst das jederzeit unter
        <code className="mx-1 rounded bg-surface-raised px-1 py-0.5 mono text-xs">/admin/settings</code>
        nachholen.
      </p>

      <label className="flex cursor-pointer items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="SMTP konfigurieren"
          onClick={() => onToggle(!enabled)}
          className={
            "relative inline-flex h-6 w-11 items-center rounded-full transition " +
            (enabled ? "bg-brand" : "bg-surface-raised border border-border")
          }
        >
          <span
            className={
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform " +
              (enabled ? "translate-x-6" : "translate-x-1")
            }
          />
        </button>
        <span className="text-sm font-medium">SMTP jetzt einrichten</span>
      </label>

      {enabled && (
        <div className="space-y-4 rounded-lg border border-border bg-surface-raised p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <FieldLabel>Host</FieldLabel>
              <TextInput value={smtp.host} onChange={(v) => onChange({ host: v })} placeholder="smtp.beispiel.de" />
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Port</FieldLabel>
              <input
                type="number"
                value={smtp.port}
                onChange={(e) => onChange({ port: Number(e.target.value) || 0 })}
                title="SMTP-Port"
                placeholder="587"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              />
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Benutzer</FieldLabel>
              <TextInput value={smtp.user} onChange={(v) => onChange({ user: v })} />
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Passwort</FieldLabel>
              <TextInput type="password" value={smtp.password} onChange={(v) => onChange({ password: v })} autoComplete="new-password" />
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Absender-Name</FieldLabel>
              <TextInput value={smtp.fromName} onChange={(v) => onChange({ fromName: v })} />
            </label>
            <label className="block space-y-1.5">
              <FieldLabel>Absender-Adresse</FieldLabel>
              <TextInput type="email" value={smtp.fromAddress} onChange={(v) => onChange({ fromAddress: v })} placeholder="noreply@deine-domain.de" />
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={smtp.secure}
              aria-label="TLS aktivieren"
              onClick={() => onChange({ secure: !smtp.secure })}
              className={
                "relative inline-flex h-6 w-11 items-center rounded-full transition " +
                (smtp.secure ? "bg-brand" : "bg-surface border border-border")
              }
            >
              <span
                className={
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform " +
                  (smtp.secure ? "translate-x-6" : "translate-x-1")
                }
              />
            </button>
            <span className="text-sm">TLS (Port 465). Für STARTTLS auf 587 deaktivieren.</span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={testing || !smtp.host || !smtp.fromAddress}
              onClick={runTest}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-border-strong disabled:opacity-60"
            >
              {testing ? "Teste …" : "Verbindung testen"}
            </button>
            {testResult && (
              <span
                className={
                  "rounded-md px-3 py-1.5 text-xs " +
                  (testResult === "ok"
                    ? "border border-brand/40 bg-brand/10 text-brand"
                    : "border border-danger/40 bg-danger/10 text-danger")
                }
              >
                {testResult}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepTheme({
  presets,
  value,
  loading,
  onChange,
}: {
  presets: { id: string; name: string; description: string }[];
  value: string | null;
  loading: boolean;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Theme-Preset bestimmt Farben, Schatten und Logo-Filter. Du kannst es
        unter <code className="mx-1 rounded bg-surface-raised px-1 py-0.5 mono text-xs">/admin/theme</code> jederzeit
        anpassen oder eigene Tokens überschreiben.
      </p>

      <button
        type="button"
        onClick={() => onChange(null)}
        className={
          "block w-full rounded-lg border p-4 text-left transition " +
          (value === null
            ? "border-brand bg-brand/5"
            : "border-border hover:border-border-strong")
        }
      >
        <p className="text-sm font-semibold">Default-Theme</p>
        <p className="text-xs text-muted">Behalte die kompilierten Primitives bei. Empfohlen, wenn du erstmal ausprobieren willst.</p>
      </button>

      {loading && <p className="text-sm text-muted">Lädt Presets …</p>}

      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={
            "block w-full rounded-lg border p-4 text-left transition " +
            (value === p.id
              ? "border-brand bg-brand/5"
              : "border-border hover:border-border-strong")
          }
        >
          <p className="text-sm font-semibold">{p.name}</p>
          <p className="text-xs text-muted">{p.description}</p>
        </button>
      ))}
    </div>
  );
}

function StepRegistration({
  value,
  onChange,
}: {
  value: RegistrationMode;
  onChange: (v: RegistrationMode) => void;
}) {
  const opts: { id: RegistrationMode; label: string; desc: string }[] = [
    { id: "OPEN", label: "Offen", desc: "Jede Person kann sich registrieren. Empfohlen, wenn du eine öffentliche Plattform willst." },
    { id: "INVITE", label: "Nur per Einladung", desc: "Registrierung blockiert — Invite-Tokens kommen in v0.3." },
    { id: "CLOSED", label: "Geschlossen", desc: "Keine neuen Accounts. Bestehende Accounts (z. B. dein Admin) bleiben aktiv." },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Lässt sich später jederzeit unter Einstellungen ändern.
      </p>
      {opts.map((o) => (
        <label
          key={o.id}
          className={
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition " +
            (value === o.id
              ? "border-brand bg-brand/5"
              : "border-border hover:border-border-strong")
          }
        >
          <input
            type="radio"
            name="registrationMode"
            checked={value === o.id}
            onChange={() => onChange(o.id)}
            className="mt-0.5 accent-brand"
          />
          <div>
            <p className="text-sm font-semibold">{o.label}</p>
            <p className="text-xs text-muted">{o.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

function StepStorage({
  acknowledged,
  onChange,
}: {
  acknowledged: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Alles, was du wissen solltest, bevor echte Videos draufkommen.
      </p>
      <ul className="space-y-2 text-sm text-foreground">
        <li className="rounded-md border border-border bg-surface-raised p-3">
          <strong>MinIO-Volumes</strong> liegen unter
          <code className="mx-1 rounded bg-surface px-1 py-0.5 mono text-xs">/mnt/user/appdata/play/minio</code>
          (Unraid) bzw. dem in <code className="mx-1 rounded bg-surface px-1 py-0.5 mono text-xs">docker-compose.yml</code>
          gemounteten Pfad. Sicher diese Volumes regelmäßig — sie enthalten alle Originale + Transkodate.
        </li>
        <li className="rounded-md border border-border bg-surface-raised p-3">
          <strong>Postgres-Backups</strong> via <code className="mono text-xs">pg_dump</code> mindestens täglich.
          Empfehlung: Cron im Host-System mit Retention 14 Tage.
        </li>
        <li className="rounded-md border border-border bg-surface-raised p-3">
          <strong>Kein GPU-Transcoding</strong> bis Frigate / CompreFace die GPU freigeben — siehe
          <code className="mx-1 rounded bg-surface px-1 py-0.5 mono text-xs">CLAUDE.md</code>.
        </li>
        <li className="rounded-md border border-border bg-surface-raised p-3">
          <strong>Reverse-Proxy</strong> (NPM auf 192.168.0.2) muss WebSocket + große Bodies (Upload) erlauben — Details
          in <code className="mx-1 rounded bg-surface px-1 py-0.5 mono text-xs">config/npm-proxy-host.md</code>.
        </li>
      </ul>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface-raised p-3 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-brand"
        />
        Ich habe die Hinweise gelesen.
      </label>
    </div>
  );
}

function StepFinish({
  form,
  error,
  pending,
}: {
  form: FormState;
  error: string | null;
  pending: boolean;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Letzter Check. Beim Abschluss wird der Admin-Account angelegt, das Theme
        gesetzt und du wirst direkt eingeloggt — danach landest du auf
        <code className="mx-1 rounded bg-surface-raised px-1 py-0.5 mono text-xs">/admin</code>.
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <SummaryRow label="Site" value={form.siteName} />
        <SummaryRow label="Sprache" value={form.locale.toUpperCase()} />
        <SummaryRow label="Tagline" value={form.siteTagline} />
        <SummaryRow label="Kontakt" value={form.contactEmail || "—"} />
        <SummaryRow label="Admin" value={`${form.adminDisplayName} (${form.adminEmail})`} />
        <SummaryRow label="Handle" value={`@${form.adminHandle}`} />
        <SummaryRow label="Logo" value={form.logoKey ?? "—"} mono />
        <SummaryRow label="Theme-Preset" value={form.themePresetId ?? "Default"} />
        <SummaryRow label="SMTP" value={form.smtpEnabled ? `${form.smtp.host}:${form.smtp.port}` : "Aus"} />
        <SummaryRow label="Registrierung" value={form.registrationMode} />
      </dl>
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}
      {pending && <p className="text-sm text-muted">Bitte warten — Datenbank wird initialisiert.</p>}
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface-raised px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-dim">{label}</dt>
      <dd className={"mt-0.5 truncate text-foreground " + (mono ? "mono text-xs" : "text-sm")}>{value}</dd>
    </div>
  );
}

// ─── Validierung ──────────────────────────────────────────────────────────

function validate(form: FormState, step: number): boolean {
  switch (step) {
    case 1:
      return form.locale === "de" || form.locale === "en";
    case 2:
      return form.siteName.trim().length > 0;
    case 3:
      return true; // optional
    case 4:
      return (
        form.adminDisplayName.trim().length > 0 &&
        /.+@.+\..+/.test(form.adminEmail.trim()) &&
        HANDLE_RE.test(form.adminHandle) &&
        form.adminPassword.length >= 10
      );
    case 5:
      if (!form.smtpEnabled) return true;
      return (
        form.smtp.host.trim().length > 0 &&
        form.smtp.port > 0 &&
        /.+@.+\..+/.test(form.smtp.fromAddress.trim()) &&
        form.smtp.fromName.trim().length > 0
      );
    case 6:
      return true;
    case 7:
      return ["OPEN", "INVITE", "CLOSED"].includes(form.registrationMode);
    case 8:
      return form.storageAcknowledged;
    case 9:
      return true;
    default:
      return false;
  }
}
