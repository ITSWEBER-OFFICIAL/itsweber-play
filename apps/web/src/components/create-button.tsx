"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Icon } from "@/components/icon";

export function CreateButton() {
  const { data: session, isPending } = useSession();
  if (isPending || !session) return null;
  return (
    <Link
      href="/studio/new"
      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-brand-hover [box-shadow:var(--shadow-glow)]"
    >
      <Icon name="plus" size={15} />
      Erstellen
    </Link>
  );
}
