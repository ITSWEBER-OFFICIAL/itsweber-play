"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "../shell";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Kein Rücksetz-Token in der URL. Fordere den Link erneut an.");
    }
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError("Das Passwort muss mindestens 10 Zeichen haben.");
      return;
    }
    if (password !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? "Passwort konnte nicht gesetzt werden.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <AuthShell
      eyebrow="Neues Passwort"
      heading="Zugang zurücksetzen"
      lede="Wähle ein starkes Passwort. Wir empfehlen mindestens 12 Zeichen, gemischt aus Buchstaben, Ziffern und Sonderzeichen."
    >
      {done ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-brand/40 bg-brand/10 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckIcon /> Passwort aktualisiert.
            </p>
            <p className="mt-2 text-sm text-muted">Du wirst gleich zur Anmeldung weitergeleitet.</p>
          </div>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-brand-hover"
          >
            Jetzt anmelden
          </Link>
        </div>
      ) : !token ? (
        <div className="space-y-5">
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            Kein Rücksetz-Token. Fordere den Link erneut an.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-brand-hover"
          >
            Neuen Link anfordern
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <PasswordField
            id="reset-new"
            label="Neues Passwort"
            value={password}
            onChange={setPassword}
            autoFocus
            autoComplete="new-password"
            minLength={10}
          />
          <PasswordField
            id="reset-confirm"
            label="Passwort bestätigen"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={10}
          />

          <PasswordStrength value={password} />

          {error && (
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password || !confirm}
            className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-neutral-900 shadow-[0_0_20px_rgba(63,228,139,0.3)] transition hover:bg-brand-hover disabled:opacity-60 disabled:shadow-none"
          >
            {isSubmitting ? "Speichere …" : "Passwort setzen"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoFocus,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-raised px-4 py-3 pr-12 text-[15px] text-foreground outline-none transition placeholder:text-dim focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const score = computeStrength(value);
  const labels = ["Zu kurz", "Schwach", "Okay", "Stark", "Sehr stark"];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              "h-1 flex-1 rounded-full transition " +
              (i < score ? "bg-brand" : "bg-border")
            }
          />
        ))}
      </div>
      <p className="text-[11px] text-dim">{labels[score] ?? "Zu kurz"}</p>
    </div>
  );
}

function computeStrength(pw: string): number {
  if (pw.length < 10) return 0;
  let score = 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length >= 16) score = Math.min(score + 1, 4);
  return Math.min(score, 4);
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.36 21.36 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.57 21.57 0 0 1-3.17 4.09M1 1l22 22M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
