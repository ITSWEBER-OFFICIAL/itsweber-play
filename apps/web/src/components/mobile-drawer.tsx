"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Icon } from "@/components/icon";

// Slide-in-Drawer für Mobile-Navigation. Wird vom SiteHeader gesteuert
// (Hamburger-Click). Schließt sich bei Backdrop-Tap, Escape, Item-Klick
// (Route-Wechsel) und blockiert Body-Scroll solange offen.
//
// WICHTIG: Drawer wird via Portal direkt in <body> gerendert. Der SiteHeader
// nutzt `backdrop-blur-md`, wodurch `<nav>` zum Containing-Block für
// fixed-Descendants wird — ohne Portal bleibt der Drawer im Header gefangen.

const NAV_LINKS = [
  { href: "/", label: "Entdecken", icon: "home" as const },
  { href: "/shorts", label: "Shorts", icon: "play" as const },
  { href: "/channels", label: "Kanäle", icon: "users" as const },
  { href: "/subs", label: "Abos", icon: "bell" as const },
  { href: "/library", label: "Bibliothek", icon: "list" as const },
];

interface User {
  handle?: string;
  role?: string;
  name?: string;
}

export function MobileDrawer({
  open,
  onClose,
  user,
  logoUrl,
}: {
  open: boolean;
  onClose: () => void;
  user: User | undefined;
  logoUrl: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Portal erst nach Mount rendern — sonst kollidiert SSR mit document.body.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Body-Scroll-Lock + Escape-Listener solange offen.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Schließen bei Route-Wechsel (Klick auf Nav-Link).
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleSignOut() {
    onClose();
    await signOut();
    router.refresh();
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (
      (e.currentTarget.elements.namedItem("q") as HTMLInputElement)?.value ?? ""
    ).trim();
    if (q.length === 0) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  if (!mounted) return null;

  // Fragment-Wrap um das Portal: React-19-Types im Monorepo werfen sonst einen
  // ReactPortal-vs-ReactNode-Konflikt (zwei @types/react-Versionen gehoistet).
  return <>{createPortal(
    <>
      {/* Backdrop */}
      <div
        className={
          "fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity md:hidden " +
          (open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0")
        }
        onClick={onClose}
      />

      {/* Drawer — Full-Width auf Mobile, überdeckt Inhalt unterhalb des Headers */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-[81] flex w-full flex-col overflow-y-auto bg-background shadow-2xl transition-transform md:hidden " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
        aria-label="Hauptmenü"
      >
        {/* Brand-Header + Schließen */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5"
            aria-label="Startseite"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="ITSWEBER"
              className="h-8 w-8 [filter:var(--logo-filter)] transition-[filter]"
            />
            <span className="bg-gradient-to-r from-foreground to-brand bg-clip-text text-base font-bold tracking-tight text-transparent">
              ITSWEBER Play
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Menü schließen"
            className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Suche */}
        <form
          role="search"
          onSubmit={handleSearch}
          className="border-b border-border px-5 py-3"
        >
          <div className="relative">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim"
            />
            <input
              name="q"
              type="search"
              placeholder="Videos, Kanäle …"
              aria-label="Suche"
              className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-brand focus:[box-shadow:0_0_0_3px_color-mix(in_srgb,var(--color-brand)_18%,transparent)]"
            />
          </div>
        </form>

        {/* Hauptnavigation */}
        <nav className="flex flex-col px-3 py-3">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-dim">
            Entdecken
          </p>
          {NAV_LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onClose}
                className={
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition " +
                  (active
                    ? "bg-brand/10 text-brand"
                    : "text-foreground hover:bg-surface")
                }
              >
                <Icon name={l.icon} size={18} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Account-Section (eingeloggt) */}
        {user ? (
          <div className="mt-auto flex flex-col border-t border-border px-3 py-3">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-dim">
              Account
            </p>
            <Link
              href="/studio/upload"
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              <Icon name="upload" size={18} />
              Video hochladen
            </Link>
            <Link
              href="/studio"
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              <Icon name="bar-chart" size={18} />
              Studio
            </Link>
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
              >
                <Icon name="wrench" size={18} />
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 flex items-center gap-3 rounded-md border border-border-strong px-3 py-2.5 text-sm font-medium text-muted transition hover:border-muted hover:bg-surface hover:text-foreground"
            >
              <Icon name="external" size={18} />
              Abmelden
            </button>
            <div className="mt-3 px-3 text-[12px] text-dim">
              Angemeldet als{" "}
              <span className="font-semibold text-foreground">
                @{user.handle ?? user.name ?? "?"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-2 border-t border-border px-5 py-4">
            <Link
              href="/login"
              onClick={onClose}
              className="rounded-md border border-border-strong px-4 py-2.5 text-center text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Anmelden
            </Link>
            <Link
              href="/register"
              onClick={onClose}
              className="rounded-md bg-brand px-4 py-2.5 text-center text-sm font-medium text-neutral-900 transition hover:bg-brand-hover [box-shadow:var(--shadow-glow)]"
            >
              Registrieren
            </Link>
          </div>
        )}
      </aside>
    </>,
    document.body,
  )}</>;
}
