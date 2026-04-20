"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";

// Wraps every /studio/* page with a common auth check and a friendly
// signed-out fallback. Callers pass the actual page as `children`.

export function StudioGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <p className="text-muted">Lädt …</p>;
  }
  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
        <p className="text-muted">
          Bitte{" "}
          <Link href="/login" className="text-brand hover:underline">
            anmelden
          </Link>
          , um dein Creator-Studio zu öffnen.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
