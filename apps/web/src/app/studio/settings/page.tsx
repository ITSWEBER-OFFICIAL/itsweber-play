"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { authClient, signOut } from "@/lib/auth-client";
import { API_URL } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/icon";

export default function StudioSettingsPage() {
  return (
    <StudioGate>
      <Settings />
    </StudioGate>
  );
}

function Settings() {
  const me = trpc.userSettings.me.useQuery();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
          Einstellungen
        </h1>
        <p className="mt-1 text-sm text-muted">
          Account, Benachrichtigungen, Datenschutz und Passwort.
        </p>
      </header>

      {me.isPending ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : me.error ? (
        <p className="text-sm text-danger">{me.error.message}</p>
      ) : me.data ? (
        <>
          <AccountSection user={me.data} onSaved={() => me.refetch()} />
          <NotificationsSection
            prefs={me.data.notificationPrefs}
            onSaved={() => me.refetch()}
          />
          <PasswordSection />
          <PrivacySection handle={me.data.handle} />
        </>
      ) : null}
    </div>
  );
}

// ─── Account ──────────────────────────────────────────────────────────

function AccountSection({
  user,
  onSaved,
}: {
  user: { displayName: string; handle: string; email: string };
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const mut = trpc.userSettings.updateDisplayName.useMutation({
    onSuccess: () => {
      toast.success("Name gespeichert.");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Section
      title="Account"
      description="Grundlegende Account-Daten."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate({ displayName });
        }}
      >
        <Field label="Anzeigename" inputId="displayName">
          <input
            id="displayName"
            type="text"
            title="Anzeigename"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            minLength={2}
            maxLength={50}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <Field label="Handle" hint="Nicht änderbar." inputId="handle">
          <input
            id="handle"
            type="text"
            title="Handle"
            value={`@${user.handle}`}
            disabled
            className="w-full cursor-not-allowed rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-muted"
          />
        </Field>
        <Field label="E-Mail" hint="Nicht änderbar." inputId="email">
          <input
            id="email"
            type="email"
            title="E-Mail"
            value={user.email}
            disabled
            className="w-full cursor-not-allowed rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-muted"
          />
        </Field>
        <SaveButton pending={mut.isPending} />
      </form>
    </Section>
  );
}

// ─── Notifications ─────────────────────────────────────────────────────

function NotificationsSection({
  prefs,
  onSaved,
}: {
  prefs: { emailOnComment: boolean; emailOnSubscriber: boolean };
  onSaved: () => void;
}) {
  const [emailOnComment, setEmailOnComment] = useState(prefs.emailOnComment);
  const [emailOnSubscriber, setEmailOnSubscriber] = useState(
    prefs.emailOnSubscriber,
  );
  const mut = trpc.userSettings.updateNotificationPrefs.useMutation({
    onSuccess: () => {
      toast.success("Benachrichtigungen gespeichert.");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Section
      title="Benachrichtigungen"
      description="E-Mail-Ereignisse. In-App-Badges bleiben immer aktiv."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate({ emailOnComment, emailOnSubscriber });
        }}
      >
        <Toggle
          label="Neue Kommentare"
          hint="Wenn jemand deine Videos kommentiert."
          checked={emailOnComment}
          onChange={setEmailOnComment}
        />
        <Toggle
          label="Neue Abonnenten"
          hint="Wenn jemand deinen Kanal abonniert."
          checked={emailOnSubscriber}
          onChange={setEmailOnSubscriber}
        />
        <SaveButton pending={mut.isPending} />
      </form>
    </Section>
  );
}

// ─── Password ─────────────────────────────────────────────────────────

function PasswordSection() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== newPw2) {
      toast.error("Neue Passwörter stimmen nicht überein.");
      return;
    }
    if (newPw.length < 10) {
      toast.error("Mindestens 10 Zeichen.");
      return;
    }
    setPending(true);
    try {
      const res = await authClient.changePassword({
        currentPassword: oldPw,
        newPassword: newPw,
      });
      if (res.error) {
        toast.error(res.error.message ?? "Fehlgeschlagen");
      } else {
        toast.success("Passwort geändert.");
        setOldPw("");
        setNewPw("");
        setNewPw2("");
      }
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Section
      title="Passwort"
      description="Mindestens 10 Zeichen. Bei Änderung bleiben andere Sessions aktiv."
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Aktuelles Passwort" inputId="pw-old">
          <input
            id="pw-old"
            type="password"
            title="Aktuelles Passwort"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <Field label="Neues Passwort" inputId="pw-new">
          <input
            id="pw-new"
            type="password"
            title="Neues Passwort"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            minLength={10}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <Field label="Neues Passwort bestätigen" inputId="pw-new2">
          <input
            id="pw-new2"
            type="password"
            title="Neues Passwort bestätigen"
            value={newPw2}
            onChange={(e) => setNewPw2(e.target.value)}
            minLength={10}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </Field>
        <SaveButton pending={pending} label="Passwort ändern" />
      </form>
    </Section>
  );
}

// ─── Privacy (Export + Delete) ─────────────────────────────────────────

function PrivacySection({ handle }: { handle: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmHandle, setConfirmHandle] = useState("");

  const del = trpc.userSettings.requestAccountDeletion.useMutation({
    onSuccess: async () => {
      toast.success("Account gelöscht.");
      await signOut();
      router.push("/");
    },
    onError: (err) => toast.error(err.message),
  });

  async function exportData() {
    try {
      const data = await utils.userSettings.exportMyData.fetch();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `play-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export gestartet.");
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    }
  }

  return (
    <Section
      title="Datenschutz"
      description="DSGVO-Export und Account-Löschung."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">
                Meine Daten exportieren
              </div>
              <div className="mt-0.5 text-xs text-muted">
                JSON mit Account, Kanälen, Videos, Kommentaren.
              </div>
            </div>
            <button
              type="button"
              onClick={exportData}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium transition hover:bg-surface-raised"
            >
              <Icon name="download" size={14} />
              Herunterladen
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-danger">
                Account löschen
              </div>
              <div className="mt-0.5 text-xs text-muted">
                Videos werden auf PRIVATE gestellt, E-Mail anonymisiert,
                Name → [gelöscht]. Kommentare bleiben als Kontext.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger/20"
            >
              Löschen …
            </button>
          </div>

          {deleteOpen && (
            <div className="mt-4 border-t border-danger/30 pt-4">
              <p className="text-xs text-muted">
                Zur Bestätigung gib bitte deinen Handle{" "}
                <span className="mono text-danger">@{handle}</span> ein:
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  title="Handle zur Bestätigung"
                  aria-label="Handle zur Bestätigung"
                  value={confirmHandle}
                  onChange={(e) => setConfirmHandle(e.target.value)}
                  placeholder={`@${handle}`}
                  className="flex-1 rounded-md border border-danger/40 bg-surface px-3 py-2 text-sm focus:border-danger focus:outline-none"
                />
                <button
                  type="button"
                  disabled={
                    confirmHandle.replace(/^@/, "") !== handle ||
                    del.isPending
                  }
                  onClick={() =>
                    del.mutate({
                      confirmHandle: confirmHandle.replace(/^@/, ""),
                    })
                  }
                  className="rounded-md bg-danger px-4 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {del.isPending ? "…" : "Unwiderruflich löschen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmHandle("");
                  }}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-xs transition hover:bg-surface-raised"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── Form primitives ───────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <header className="mb-5">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  inputId,
  children,
}: {
  label: string;
  hint?: string;
  inputId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-xs font-medium text-foreground"
      >
        {label}
      </label>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-dim">{hint}</span>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-raised px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={
          "relative h-6 w-11 shrink-0 rounded-full border transition " +
          (checked
            ? "border-brand bg-brand"
            : "border-border bg-surface")
        }
      >
        <span
          className={
            "absolute top-0.5 h-4 w-4 rounded-full bg-neutral-900 shadow transition " +
            (checked ? "right-0.5" : "left-0.5")
          }
        />
      </button>
    </div>
  );
}

function SaveButton({
  pending,
  label = "Speichern",
}: {
  pending: boolean;
  label?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}
