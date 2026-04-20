"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  APP_NAME,
  APP_VERSION,
  COPYRIGHT_NOTICE,
  PRODUCT_HOMEPAGE,
  UPSTREAM_LICENSE,
  UPSTREAM_NAME,
  UPSTREAM_URL,
  VENDOR_NAME,
  VENDOR_URL,
} from "@/lib/branding";

// Schlanker Footer. Die untere Upstream-Zeile ist AGPL-Pflicht und
// nicht per Env ausschaltbar — User-Branding (APP_NAME, VENDOR_*,
// AUTHOR_*) kommt aus NEXT_PUBLIC_*-Env-Vars.
//
// Ausgeblendet auf vollflächigen Routen (Shorts-Vertical-Feed).

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

  const homeHref = PRODUCT_HOMEPAGE || "/";

  return (
    <footer className="mt-24 border-t border-border py-8 text-sm text-dim">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 md:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href={homeHref}
            className="font-semibold text-foreground transition hover:text-brand"
          >
            {APP_NAME}
          </Link>
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

          {COPYRIGHT_NOTICE && (
            <span className="ml-auto mono text-[11px] opacity-70">
              {COPYRIGHT_NOTICE}
            </span>
          )}
        </div>

        {/* Upstream-Attribution — AGPL-Pflicht, fest verankert. */}
        <div className="mono text-[10px] uppercase tracking-wider opacity-60">
          {VENDOR_NAME && VENDOR_URL ? (
            <>
              <a
                href={VENDOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand"
              >
                {VENDOR_NAME}
              </a>{" "}
              ·{" "}
            </>
          ) : null}
          powered by{" "}
          <a
            href={UPSTREAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand"
          >
            {UPSTREAM_NAME}
          </a>{" "}
          · {UPSTREAM_LICENSE}
        </div>
      </div>
    </footer>
  );
}
