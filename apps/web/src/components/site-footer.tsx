"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  APP_NAME,
  APP_VERSION,
  AUTHOR_NAME,
  VENDOR_NAME,
  VENDOR_URL,
  PRODUCT_HOMEPAGE,
} from "@/lib/branding";

// Schlanker Footer. Die „powered by"-Zeile und das ©-Copyright sind fest
// verdrahtet (siehe apps/web/src/lib/branding.ts) — SiteSettings kann
// Titel/Tagline ändern, aber nicht die Urheberschaft verschleiern.
//
// Ausgeblendet auf vollflächigen Routen (Shorts-Vertical-Feed), wo der
// Footer das Snap-Scroll-Layout brechen würde.

const FOOTER_LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/help", label: "Hilfe" },
];

const HIDDEN_ON_PATHS = ["/shorts"];

export function SiteFooter() {
  const pathname = usePathname();
  if (HIDDEN_ON_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <footer className="mt-24 border-t border-border py-8 text-sm text-dim">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 md:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href={PRODUCT_HOMEPAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground transition hover:text-brand"
          >
            {APP_NAME}
          </a>
          <span className="mono text-[11px] opacity-70">{APP_VERSION}</span>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-muted transition hover:text-brand"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <span className="ml-auto mono text-[11px] opacity-70">
            {"\u00A9"} {new Date().getFullYear()} {AUTHOR_NAME} · {VENDOR_NAME}
          </span>
        </div>

        {/* Urheber-Zeile — nicht via Admin-UI änderbar (AGPL-Attribution). */}
        <div className="mono text-[10px] uppercase tracking-wider opacity-60">
          <a
            href={PRODUCT_HOMEPAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand"
          >
            {APP_NAME}
          </a>{" "}
          — powered by{" "}
          <a
            href={VENDOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand"
          >
            {VENDOR_NAME}
          </a>
        </div>
      </div>
    </footer>
  );
}
