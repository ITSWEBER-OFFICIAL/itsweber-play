"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn.email({ email, password });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? "Anmeldung fehlgeschlagen.");
      return;
    }
    const next = searchParams.get("next") ?? "/";
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <p className="text-sm text-muted">
          Noch keinen Account?{" "}
          <Link href="/register" className="text-brand hover:underline">
            Registrieren
          </Link>
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted">E-Mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-brand"
          />
        </label>
        <label className="block space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted">Passwort</span>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted transition hover:text-brand"
            >
              Passwort vergessen?
            </Link>
          </div>
          <input
            type="password"
            required
            minLength={10}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-brand"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-brand px-4 py-2 font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60"
        >
          {isSubmitting ? "…" : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
