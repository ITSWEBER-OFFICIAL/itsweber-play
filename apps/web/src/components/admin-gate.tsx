"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";

// Role-gated wrapper for every /admin/* page. Three states: loading,
// signed-out → Login-CTA, non-admin → Forbidden.

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <p className="text-muted">Lädt …</p>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted">
          <Link href="/login" className="text-brand hover:underline">
            Anmelden
          </Link>
          , um diesen Bereich zu öffnen.
        </p>
      </div>
    );
  }
  const user = session.user as { role?: string };
  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Kein Zugriff</h1>
        <p className="text-muted">
          Dieser Bereich ist für Admins. Deine Rolle:{" "}
          <span className="mono text-brand">{user.role ?? "?"}</span>
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
