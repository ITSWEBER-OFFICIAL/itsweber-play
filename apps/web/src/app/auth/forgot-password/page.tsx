"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "../shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/auth/reset-password",
    });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? "Rücksetz-Link konnte nicht angefordert werden.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      eyebrow="Zugang wiederherstellen"
      heading="Passwort vergessen?"
      lede="Gib deine E-Mail-Adresse ein — wir schicken dir einen Link, mit dem du ein neues Passwort vergeben kannst."
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-brand/40 bg-brand/10 p-5">
            <p className="text-sm font-medium text-foreground">
              Wenn es zu <span className="font-mono text-brand">{email}</span> einen Account gibt, ist eine E-Mail unterwegs.
            </p>
            <p className="mt-2 text-sm text-muted">
              Der Link ist 60 Minuten gültig. Schau auch im Spam-Ordner nach, falls er nicht innerhalb weniger Minuten ankommt.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-foreground"
          >
            <ArrowLeftIcon /> Zurück zum Login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">E-Mail-Adresse</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.de"
              className="w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-[15px] text-foreground outline-none transition placeholder:text-dim focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-neutral-900 shadow-[0_0_20px_rgba(63,228,139,0.3)] transition hover:bg-brand-hover disabled:opacity-60 disabled:shadow-none"
          >
            {isSubmitting ? "Sende …" : "Rücksetz-Link anfordern"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-muted transition hover:text-foreground">
              <ArrowLeftIcon /> Zurück
            </Link>
            <Link href="/register" className="text-muted transition hover:text-foreground">
              Neuer Account →
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
