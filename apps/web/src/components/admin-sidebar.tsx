"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import {
  APP_NAME,
  APP_VERSION,
  AUTHOR_NAME,
  VENDOR_NAME,
  VENDOR_URL,
} from "@/lib/branding";

// Admin-side navigation mirroring previews/admin.html:
// Overview (Dashboard / Nutzer / Videos / Moderation)
// Erscheinungsbild (Theme-Editor / Startseiten-Blöcke)
// System (Transcoding-Queue / Einstellungen)

const OverviewIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);
const UsersIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
  </svg>
);
const VideosIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </svg>
);
const ModIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const ThemeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);
const BlocksIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);
const SystemIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
);

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | null;
  wip?: boolean;
  matchExact?: boolean;
}

export function AdminSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
} = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as
    | { handle?: string; role?: string }
    | undefined;

  // Schließen bei Route-Wechsel (Klick auf Item).
  useEffect(() => {
    if (mobileOpen && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Body-Scroll-Lock während Drawer offen.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const dashboard = trpc.admin.dashboard.useQuery(undefined, {
    enabled: user?.role === "ADMIN",
    staleTime: 30_000,
  });
  const openReports = trpc.report.openCount.useQuery(undefined, {
    enabled: user?.role === "ADMIN",
    refetchInterval: 60_000,
  });

  const overview: Item[] = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: OverviewIcon,
      matchExact: true,
    },
    {
      href: "/admin/users",
      label: "Nutzer",
      icon: UsersIcon,
      badge: dashboard.data?.users.total ?? null,
    },
    {
      href: "/admin/videos",
      label: "Videos",
      icon: VideosIcon,
      badge: dashboard.data?.videos.total ?? null,
    },
    {
      href: "/admin/moderation",
      label: "Moderation",
      icon: ModIcon,
      badge: openReports.data ?? null,
    },
  ];
  const styling: Item[] = [
    { href: "/admin/theme", label: "Theme-Editor", icon: ThemeIcon },
    {
      href: "/admin/page-blocks",
      label: "Startseiten-Blöcke",
      icon: BlocksIcon,
    },
    {
      href: "/admin/categories",
      label: "Kategorien",
      icon: BlocksIcon,
    },
    { href: "/admin/pages", label: "Seiten (Impressum …)", icon: BlocksIcon },
  ];
  const system: Item[] = [
    {
      href: "/admin/system",
      label: "System",
      icon: SystemIcon,
      badge:
        (dashboard.data?.videos.processing ?? 0) +
          (dashboard.data?.videos.failed ?? 0) || null,
    },
    { href: "/admin/settings", label: "Einstellungen", icon: SystemIcon },
    { href: "/admin/email-templates", label: "E-Mail-Templates", icon: SystemIcon },
  ];

  return (
    <>
      {/* Mobile-Backdrop */}
      <div
        className={
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden " +
          (mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0")
        }
        onClick={onClose}
      />
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 h-screen w-[260px] overflow-y-auto border-r border-border bg-background px-3 py-4 transition-transform md:sticky md:top-[68px] md:z-auto md:h-[calc(100vh-68px)] md:w-[240px] md:translate-x-0 md:bg-background/60 md:backdrop-blur " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")
        }
      >
        <div className="mb-4 flex items-center justify-between px-3">
          <div className="mono text-[11px] uppercase tracking-wider text-dim">
            ITSWEBER Play · Admin
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Menü schließen"
            className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

      <SectionLabel>Overview</SectionLabel>
      <Section items={overview} pathname={pathname} />

      <SectionLabel>Erscheinungsbild</SectionLabel>
      <Section items={styling} pathname={pathname} />

      <SectionLabel>System</SectionLabel>
      <Section items={system} pathname={pathname} />

      <div className="mt-6 px-3 text-[11px] text-dim">
        Eingeloggt als{" "}
        <span className="mono text-brand">@{user?.handle ?? "…"}</span>
      </div>

      {/* Urheber-Hinweis am Fuß der Sidebar — nicht durch SiteSettings änderbar (AGPL-Attribution). */}
      <div className="mt-6 border-t border-border px-3 pt-3 text-[10px] leading-relaxed text-dim">
        <div className="mono uppercase tracking-wider opacity-70">
          {APP_NAME} · {APP_VERSION}
        </div>
        <div className="mt-0.5">
          {"\u00A9"} {new Date().getFullYear()} {AUTHOR_NAME}
        </div>
        <div className="mt-0.5">
          powered by{" "}
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
    </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono mt-5 mb-2 px-3 text-[11px] uppercase tracking-wider text-dim">
      {children}
    </div>
  );
}

function Section({
  items,
  pathname,
}: {
  items: Item[];
  pathname: string | null;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active = it.matchExact
          ? pathname === it.href
          : pathname?.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition " +
              (active
                ? "bg-brand/15 text-brand"
                : "text-muted hover:bg-surface hover:text-foreground")
            }
          >
            <span className="shrink-0">{it.icon}</span>
            <span className="flex-1 truncate">{it.label}</span>
            {it.wip && (
              <span className="mono rounded bg-border px-1 py-0.5 text-[9px] text-dim">
                WIP
              </span>
            )}
            {it.badge != null && it.badge > 0 && (
              <span className="mono rounded-full bg-brand/20 px-1.5 py-0.5 text-[10px] text-brand">
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
