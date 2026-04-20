"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";
import { toast } from "@/lib/toast";
import { InfoTooltip } from "@/components/info-tooltip";

export default function AdminSettingsPage() {
  return (
    <AdminGate>
      <SettingsPanel />
    </AdminGate>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type RegistrationMode = "OPEN" | "INVITE" | "CLOSED";
type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE" | "LOGGED_IN";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function FormRow({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  id,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
    />
  );
}

function SaveButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="self-start rounded-md bg-brand px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60"
    >
      {pending ? "Speichern …" : "Speichern"}
    </button>
  );
}

// ─── Section: Allgemein ──────────────────────────────────────────────────────

function SectionGeneral({ initialData }: { initialData: { siteName: string; siteTagline: string; contactEmail: string; defaultLocale: string } }) {
  const [siteName, setSiteName] = useState(initialData.siteName);
  const [siteTagline, setSiteTagline] = useState(initialData.siteTagline);
  const [contactEmail, setContactEmail] = useState(initialData.contactEmail);
  const [defaultLocale, setDefaultLocale] = useState(initialData.defaultLocale);
  const utils = trpc.useUtils();
  const update = trpc.siteSettings.update.useMutation({
    onSuccess: () => { toast.success("Allgemeine Einstellungen gespeichert"); utils.siteSettings.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-5">
      <h2 className="text-base font-bold">Allgemein</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Site-Name" htmlFor="siteName">
          <Input id="siteName" value={siteName} onChange={setSiteName} />
        </FormRow>
        <FormRow label="Tagline" htmlFor="siteTagline">
          <Input id="siteTagline" value={siteTagline} onChange={setSiteTagline} />
        </FormRow>
        <FormRow label="Kontakt-E-Mail" htmlFor="contactEmail">
          <Input id="contactEmail" type="email" value={contactEmail} onChange={setContactEmail} />
        </FormRow>
        <FormRow label="Standard-Sprache" htmlFor="defaultLocale">
          <select
            id="defaultLocale"
            title="Standard-Sprache"
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          >
            <option value="de">Deutsch (de)</option>
            <option value="en">English (en)</option>
          </select>
        </FormRow>
      </div>
      <SaveButton
        pending={update.isPending}
        onClick={() => update.mutate({ siteName, siteTagline, contactEmail, defaultLocale: defaultLocale as "de" | "en" })}
      />
    </section>
  );
}

// ─── Section: Registrierung ──────────────────────────────────────────────────

const REGISTRATION_OPTIONS: { value: RegistrationMode; label: string; desc: string }[] = [
  { value: "OPEN", label: "Offen", desc: "Jede Person kann sich registrieren." },
  { value: "INVITE", label: "Nur per Einladung", desc: "Registrierung blockiert — Einladungs-Tokens kommen in v0.3." },
  { value: "CLOSED", label: "Geschlossen", desc: "Keine neuen Registrierungen möglich. Bestehende Accounts sind nicht betroffen." },
];

function SectionRegistration({ initialMode }: { initialMode: RegistrationMode }) {
  const [mode, setMode] = useState<RegistrationMode>(initialMode);
  const utils = trpc.useUtils();
  const update = trpc.siteSettings.update.useMutation({
    onSuccess: () => { toast.success("Registrierungs-Modus gespeichert"); utils.siteSettings.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold">Registrierung</h2>
        <InfoTooltip
          content="Steuert, wer sich auf der Plattform registrieren kann. OPEN = alle, INVITE = gesperrt (Tokens kommen in v0.3), CLOSED = keine neuen Accounts."
          helpHref="/help#registration"
        />
      </div>
      <div className="space-y-3">
        {REGISTRATION_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition " +
              (mode === opt.value
                ? "border-brand bg-brand/5"
                : "border-border hover:border-border-strong")
            }
          >
            <input
              type="radio"
              name="registrationMode"
              value={opt.value}
              checked={mode === opt.value}
              onChange={() => setMode(opt.value)}
              className="mt-0.5 accent-brand"
            />
            <div>
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs text-muted">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
      <SaveButton
        pending={update.isPending}
        onClick={() => update.mutate({ registrationMode: mode })}
      />
    </section>
  );
}

// ─── Section: Video-Defaults ─────────────────────────────────────────────────

function SectionVideoDefaults({
  initialData,
}: {
  initialData: {
    defaultVisibility: Visibility;
    defaultCommentsEnabled: boolean;
    defaultCategoryId: string | null;
  };
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialData.defaultVisibility);
  const [commentsEnabled, setCommentsEnabled] = useState(initialData.defaultCommentsEnabled);
  const categories = trpc.category.list.useQuery();
  const [categoryId, setCategoryId] = useState<string>(initialData.defaultCategoryId ?? "");
  const utils = trpc.useUtils();
  const update = trpc.siteSettings.update.useMutation({
    onSuccess: () => { toast.success("Video-Defaults gespeichert"); utils.siteSettings.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-5">
      <h2 className="text-base font-bold">Video-Defaults</h2>
      <p className="text-sm text-muted">
        Gelten für neu hochgeladene/importierte Videos als Fallback, wenn der Creator keinen eigenen Wert setzt.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow
          label={<span className="flex items-center gap-1">Standard-Sichtbarkeit <InfoTooltip content="Wird als Default-Wert für neu hochgeladene Videos gesetzt. Creators können das im Editor überschreiben." helpHref="/help#visibility" /></span>}
          htmlFor="defaultVisibility"
        >
          <select
            id="defaultVisibility"
            title="Standard-Sichtbarkeit"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          >
            <option value="PRIVATE">Privat</option>
            <option value="UNLISTED">Nicht gelistet</option>
            <option value="PUBLIC">Öffentlich</option>
            <option value="LOGGED_IN">Eingeloggte Nutzer</option>
          </select>
        </FormRow>
        <FormRow label="Standard-Kategorie" htmlFor="defaultCategory">
          <select
            id="defaultCategory"
            title="Standard-Kategorie"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          >
            <option value="">— keine —</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormRow>
      </div>
      <label className="flex cursor-pointer items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={commentsEnabled ? "true" : "false"}
          onClick={() => setCommentsEnabled((v) => !v)}
          className={
            "relative inline-flex h-6 w-11 items-center rounded-full transition " +
            (commentsEnabled ? "bg-brand" : "bg-surface-raised border border-border")
          }
        >
          <span
            className={
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform " +
              (commentsEnabled ? "translate-x-6" : "translate-x-1")
            }
          />
        </button>
        <span className="text-sm">Kommentare standardmäßig aktiviert</span>
      </label>
      <SaveButton
        pending={update.isPending}
        onClick={() =>
          update.mutate({
            defaultVisibility: visibility,
            defaultCommentsEnabled: commentsEnabled,
            defaultCategoryId: categoryId || null,
          })
        }
      />
    </section>
  );
}

// ─── Section: E-Mail / SMTP ──────────────────────────────────────────────────

function SectionEmail() {
  const smtp = trpc.admin.smtp.get.useQuery();
  const utils = trpc.useUtils();

  const update = trpc.admin.smtp.update.useMutation({
    onSuccess: () => {
      toast.success("SMTP-Einstellungen gespeichert");
      utils.admin.smtp.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const testConnection = trpc.admin.smtp.testConnection.useMutation({
    onSuccess: (res) => {
      if (res.ok) toast.success("Verbindung OK");
      else toast.error(`Fehler: ${res.error}`);
      utils.admin.smtp.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const sendTest = trpc.admin.smtp.sendTestMail.useMutation({
    onSuccess: () => {
      toast.success("Test-Mail gesendet");
      utils.admin.smtp.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [host, setHost] = useState("");
  const [port, setPort] = useState<number>(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [testTo, setTestTo] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Ein-Schuss-Hydration aus der Query, sobald Daten da sind — danach
  // regiert der lokale State, damit Typing nicht vom Refetch überschrieben wird.
  if (!hydrated && smtp.data) {
    setHost(smtp.data.host);
    setPort(smtp.data.port);
    setSecure(smtp.data.secure);
    setUser(smtp.data.user);
    setFromName(smtp.data.fromName);
    setFromAddress(smtp.data.fromAddress);
    setHydrated(true);
  }

  const passwordPlaceholder = smtp.data?.passwordSet
    ? "••••••••  (leer lassen = unverändert)"
    : "SMTP-Passwort";

  const lastTestLabel = smtp.data?.lastTestAt
    ? new Date(smtp.data.lastTestAt).toLocaleString("de-DE")
    : null;
  const lastResult = smtp.data?.lastTestResult ?? null;
  const lastOk = lastResult?.startsWith("ok") ?? false;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold">E-Mail (SMTP)</h2>
        <p className="mt-1 text-sm text-muted">
          Konfiguration für Verifikations-, Password-Reset- und Benachrichtigungs-Mails. Ohne gesetzten Host werden Mails nur ins Server-Log geschrieben.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="SMTP-Host" htmlFor="smtpHost">
          <Input id="smtpHost" value={host} onChange={setHost} />
        </FormRow>
        <FormRow label="Port" htmlFor="smtpPort">
          <input
            id="smtpPort"
            type="number"
            inputMode="numeric"
            title="SMTP-Port"
            placeholder="587"
            value={port}
            onChange={(e) => setPort(Number(e.target.value) || 0)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          />
        </FormRow>
        <FormRow label="Benutzername" htmlFor="smtpUser">
          <Input id="smtpUser" value={user} onChange={setUser} />
        </FormRow>
        <FormRow label="Passwort" htmlFor="smtpPass">
          <input
            id="smtpPass"
            type="password"
            autoComplete="new-password"
            value={password}
            placeholder={passwordPlaceholder}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          />
        </FormRow>
        <FormRow label="Absender-Name" htmlFor="smtpFromName">
          <Input id="smtpFromName" value={fromName} onChange={setFromName} />
        </FormRow>
        <FormRow label="Absender-Adresse" htmlFor="smtpFromAddress">
          <Input
            id="smtpFromAddress"
            type="email"
            value={fromAddress}
            onChange={setFromAddress}
          />
        </FormRow>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={secure}
          aria-label="TLS aktivieren"
          onClick={() => setSecure((v) => !v)}
          className={
            "relative inline-flex h-6 w-11 items-center rounded-full transition " +
            (secure ? "bg-brand" : "bg-surface-raised border border-border")
          }
        >
          <span
            className={
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform " +
              (secure ? "translate-x-6" : "translate-x-1")
            }
          />
        </button>
        <span className="text-sm">
          TLS (Port 465) verwenden — für STARTTLS auf Port 587 deaktivieren
        </span>
      </label>

      <div className="flex flex-wrap gap-3 pt-2">
        <SaveButton
          pending={update.isPending}
          onClick={() =>
            update.mutate({
              host: host.trim(),
              port,
              secure,
              user: user.trim(),
              password: password.length > 0 ? password : undefined,
              fromName: fromName.trim(),
              fromAddress: fromAddress.trim(),
            })
          }
        />
        <button
          type="button"
          disabled={testConnection.isPending || !smtp.data?.host}
          onClick={() => testConnection.mutate()}
          className="rounded-md border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-foreground transition hover:border-border-strong disabled:opacity-60"
        >
          {testConnection.isPending ? "Teste …" : "Testverbindung"}
        </button>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="empfaenger@example.com"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          />
          <button
            type="button"
            disabled={sendTest.isPending || !testTo}
            onClick={() => sendTest.mutate({ to: testTo.trim() })}
            className="rounded-md border border-brand/50 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/20 disabled:opacity-60"
          >
            {sendTest.isPending ? "Sende …" : "Test-Mail senden"}
          </button>
        </div>
      </div>

      {lastTestLabel && (
        <div
          className={
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm " +
            (lastOk
              ? "border-brand/40 bg-brand/10 text-foreground"
              : "border-danger/40 bg-danger/10 text-danger")
          }
        >
          <span
            className={
              "inline-flex h-2 w-2 rounded-full " +
              (lastOk ? "bg-brand" : "bg-danger")
            }
          />
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Letzter Test · {lastTestLabel}
            </p>
            <p className="mt-0.5 mono text-xs">{lastResult}</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Section: Info/Env ───────────────────────────────────────────────────────

function SectionInfo() {
  const health = trpc.admin.system.health.useQuery();

  const env = health.data?.env;

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: "Node-Env", value: env?.nodeEnv },
    { label: "FFmpeg", value: env?.ffmpegVersion },
    { label: "yt-dlp", value: env?.ytdlpVersion },
    { label: "Max Upload", value: env?.maxUploadMB ? `${env.maxUploadMB} MB` : null },
    { label: "API-URL", value: env?.apiUrl },
    { label: "Public-URL", value: env?.publicUrl },
    { label: "S3-Endpoint", value: env?.s3Endpoint },
    { label: "Redis-Host", value: env?.redisHost },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <h2 className="text-base font-bold">Umgebung</h2>
      <p className="text-sm text-muted">Read-only Snapshot aus Environment und installierten Tools.</p>
      {health.isPending ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-surface-raised px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-dim">{label}</dt>
              <dd className="mono mt-1 truncate text-sm text-foreground">
                {value ?? <span className="text-dim">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

function SettingsPanel() {
  const settings = trpc.siteSettings.get.useQuery();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-extrabold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted">
          Site-Konfiguration, Registrierung, Video-Defaults und Umgebungs-Info.
        </p>
      </header>

      {settings.isPending ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : settings.error ? (
        <p className="text-sm text-danger">{settings.error.message}</p>
      ) : settings.data ? (
        <div className="space-y-6">
          <SectionGeneral
            initialData={{
              siteName: settings.data.siteName,
              siteTagline: settings.data.siteTagline,
              contactEmail: settings.data.contactEmail,
              defaultLocale: settings.data.defaultLocale,
            }}
          />
          <SectionRegistration initialMode={settings.data.registrationMode as RegistrationMode} />
          <SectionVideoDefaults
            initialData={{
              defaultVisibility: settings.data.defaultVisibility as Visibility,
              defaultCommentsEnabled: settings.data.defaultCommentsEnabled,
              defaultCategoryId: settings.data.defaultCategoryId,
            }}
          />
          <SectionEmail />
          <SectionInfo />
        </div>
      ) : null}
    </div>
  );
}
