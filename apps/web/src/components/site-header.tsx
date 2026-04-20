"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { NotificationBell } from "@/components/notification-bell";
import { InboxBell } from "@/components/inbox-bell";
import { CreateButton } from "@/components/create-button";
import { MobileDrawer } from "@/components/mobile-drawer";
import { Icon } from "@/components/icon";

// Fallback aufs ITSWEBER-Default-Logo, solange kein Admin-Upload vorliegt.
// Per SSE-„theme:applied" wird der State live auf eine MinIO-Asset-URL getauscht.
const DEFAULT_LOGO_URL =
  "https://itsweber.de/uploads/media/logos/media_d5e82b218f8b98cd.png";

const NAV_LINKS = [
  { href: "/", label: "Entdecken" },
  { href: "/shorts", label: "Shorts" },
  { href: "/channels", label: "Kanäle" },
  { href: "/subs", label: "Abos" },
  { href: "/library", label: "Bibliothek" },
];

export function SiteHeader({
  initialLogoUrl,
}: {
  initialLogoUrl?: string | null;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // SSR-Wert als Seed; bei SSE-Theme-Changes swappen wir das src ohne Reload.
  const [logoUrl, setLogoUrl] = useState<string>(
    initialLogoUrl || DEFAULT_LOGO_URL,
  );
  useEffect(() => {
    const onApplied = (ev: Event) => {
      const detail = (ev as CustomEvent<{ logoUrl?: string | null }>).detail;
      setLogoUrl(detail?.logoUrl || DEFAULT_LOGO_URL);
    };
    window.addEventListener("theme:applied", onApplied);
    return () => window.removeEventListener("theme:applied", onApplied);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.refresh();
  }

  const user = session?.user as
    | { handle?: string; role?: string; name?: string }
    | undefined;
  const avatarChar = (user?.handle?.[0] ?? user?.name?.[0] ?? "?").toUpperCase();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md saturate-[1.5]">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center gap-3 px-3 sm:gap-5 sm:px-5 md:gap-7 md:px-8">
        {/* Hamburger — nur Mobile */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Menü öffnen"
          className="grid h-10 w-10 place-items-center rounded-md text-foreground transition hover:bg-surface md:hidden"
        >
          <Icon name="menu" size={22} />
        </button>

        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 md:gap-3"
          aria-label="ITSWEBER Play Startseite"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="ITSWEBER"
            className="h-9 w-9 [filter:var(--logo-filter)] transition-[filter]"
          />
          {/* Wortmarke voll auf allen Breakpoints */}
          <span className="whitespace-nowrap bg-gradient-to-r from-foreground to-brand bg-clip-text text-[16px] font-bold tracking-tight text-transparent sm:text-[20px]">
            ITSWEBER Play
            <sup className="mono ml-1 align-super text-[9px] font-medium text-brand sm:ml-1.5 sm:text-[10px]">
              BETA
            </sup>
          </span>
        </Link>

        {/* Nav-Links (desktop) */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "rounded-md px-3.5 py-2 text-sm font-medium transition " +
                  (active
                    ? "bg-brand/10 text-brand"
                    : "text-muted hover:bg-surface hover:text-foreground")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Search */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = (
              (e.currentTarget.elements.namedItem("q") as HTMLInputElement)
                ?.value ?? ""
            ).trim();
            if (q.length === 0) return;
            router.push(`/search?q=${encodeURIComponent(q)}`);
          }}
          className="relative hidden flex-1 items-center md:flex"
        >
          <svg
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-dim"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            name="q"
            type="search"
            placeholder="Videos, Kanäle, Tags durchsuchen …"
            aria-label="Videos, Kanäle, Tags durchsuchen"
            className="h-10 w-full max-w-[520px] rounded-full border border-border bg-surface pl-10 pr-14 text-sm text-foreground outline-none transition focus:border-brand focus:[box-shadow:0_0_0_3px_color-mix(in_srgb,var(--color-brand)_18%,transparent)]"
          />
          <kbd className="mono absolute right-3 rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[11px] text-dim">
            /
          </kbd>
        </form>

        {/* Actions — Mobile zeigt nur Bells + Avatar, Rest im Drawer */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          {isPending ? (
            <span className="text-sm text-muted">…</span>
          ) : session ? (
            <>
              <div className="hidden md:block">
                <CreateButton />
              </div>
              <Link
                href="/studio"
                className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground md:inline-flex"
              >
                Studio
              </Link>
              {user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground lg:inline-flex"
                >
                  Admin
                </Link>
              )}
              <InboxBell />
              <NotificationBell />
              <button
                type="button"
                onClick={handleSignOut}
                title="Abmelden"
                className="hidden rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-muted transition hover:border-muted hover:text-foreground md:inline-flex"
              >
                Abmelden
              </button>
              <div
                className="grid h-9 w-9 place-items-center rounded-full border border-border-strong bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-bold text-neutral-900"
                title={`@${user?.handle ?? user?.name ?? "?"}`}
              >
                {avatarChar}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-md border border-border-strong px-4 py-2 text-sm font-medium transition hover:bg-surface md:inline-flex"
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover [box-shadow:var(--shadow-glow)] sm:px-4"
              >
                Registrieren
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile-Drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        logoUrl={logoUrl}
      />
    </nav>
  );
}
