"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signUp.email({
      email,
      password,
      name: displayName,
      handle,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? "Registrierung fehlgeschlagen.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Account erstellen</h1>
        <p className="text-sm text-muted">
          Schon dabei?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Anmelden
          </Link>
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted">
            Anzeigename
          </span>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-brand"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted">
            Handle (@URL-safe, einmalig)
          </span>
          <input
            type="text"
            required
            pattern="[a-z0-9_-]{3,30}"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            placeholder="z.B. mein-kanal"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-foreground outline-none focus:border-brand"
          />
        </label>

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
          <span className="text-xs uppercase tracking-wider text-muted">
            Passwort (min. 10 Zeichen)
          </span>
          <input
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
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
          {isSubmitting ? "…" : "Account erstellen"}
        </button>
      </form>
    </main>
  );
}
