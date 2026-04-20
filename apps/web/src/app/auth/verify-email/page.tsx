"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "../shell";

type State =
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; message: string };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<State>({ status: "pending" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Kein Verifikations-Token in der URL." });
      return;
    }
    let cancelled = false;
    (async () => {
      const { error } = await authClient.verifyEmail({ query: { token } });
      if (cancelled) return;
      if (error) {
        setState({ status: "error", message: error.message ?? "Verifikation fehlgeschlagen." });
      } else {
        setState({ status: "success" });
        setTimeout(() => {
          if (!cancelled) router.push("/");
        }, 1600);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <AuthShell
      eyebrow="E-Mail bestätigen"
      heading={
        state.status === "success"
          ? "Bestätigt."
          : state.status === "error"
            ? "Das hat nicht geklappt."
            : "Einen Moment …"
      }
      lede={
        state.status === "success"
          ? "Deine E-Mail-Adresse ist jetzt verifiziert. Wir leiten dich gleich zur Startseite weiter."
          : state.status === "error"
            ? "Der Link ist abgelaufen oder ungültig. Du kannst einen neuen Verifikations-Link über dein Profil anfordern."
            : "Wir prüfen deinen Token bei Better Auth."
      }
    >
      <div className="flex flex-col items-center gap-6 py-6">
        {state.status === "pending" && <Spinner />}
        {state.status === "success" && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand shadow-[0_0_32px_rgba(63,228,139,0.35)]">
            <CheckIcon />
          </div>
        )}
        {state.status === "error" && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/15 text-danger">
            <AlertIcon />
          </div>
        )}

        {state.status === "error" && (
          <div className="w-full space-y-4">
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-center text-sm text-danger">
              {state.message}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/login"
                className="rounded-lg border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-foreground transition hover:border-border-strong"
              >
                Zum Login
              </Link>
              <Link
                href="/"
                className="rounded-lg bg-brand px-4 py-3 text-center text-sm font-semibold text-neutral-900 transition hover:bg-brand-hover"
              >
                Zur Startseite
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function Spinner() {
  return (
    <div
      className="h-12 w-12 animate-spin rounded-full border-2 border-border border-t-brand"
      aria-label="Lädt"
      role="status"
    />
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
