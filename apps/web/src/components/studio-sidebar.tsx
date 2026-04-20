"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

// Shared left-sidebar for all /studio/* routes. Mirrors previews/studio.html
// structure (Dashboard · Meine Videos · Upload/Import · Analytics · Kommentare
// | Kanal-Profil · Branding · Abonnenten | Einstellungen · Abmelden).

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
  badgeKey?: "videos" | "comments";
  wip?: boolean;
}

const OverviewIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);
const VideosIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </svg>
);
const UploadIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const AnalyticsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const CommentsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);
const ChannelIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const BrandingIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const SubsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
  </svg>
);

const PlaylistIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const ITEMS_CREATOR: Item[] = [
  { href: "/studio", label: "Dashboard", icon: OverviewIcon },
  { href: "/studio/videos", label: "Meine Videos", icon: VideosIcon, badgeKey: "videos" },
  { href: "/studio/upload", label: "Upload / Import", icon: UploadIcon },
  { href: "/studio/playlists", label: "Playlists", icon: PlaylistIcon },
  { href: "/studio/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/studio/comments", label: "Kommentare", icon: CommentsIcon, badgeKey: "comments" },
];

const ITEMS_CHANNEL: Item[] = [
  { href: "/studio/channel", label: "Kanal-Profil", icon: ChannelIcon },
  { href: "/studio/branding", label: "Branding", icon: BrandingIcon },
  { href: "/studio/subscribers", label: "Abonnenten", icon: SubsIcon },
];

export function StudioSidebar({
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

  const dashboard = trpc.studio.dashboard.useQuery(undefined, {
    enabled: !!session,
    staleTime: 30_000,
  });
  const badges = {
    videos: dashboard.data?.counts.total ?? null,
    comments: null, // Schema-Count folgt
  };

  const roleLabel = user?.role === "ADMIN" ? "Admin" : "Creator";

  // Schließen bei Route-Wechsel.
  useEffect(() => {
    if (mobileOpen && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Body-Scroll-Lock.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
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
            @{user?.handle ?? "…"} · {roleLabel}
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

        <Section items={ITEMS_CREATOR} pathname={pathname} badges={badges} />

        <div className="mono mt-6 mb-2 px-3 text-[11px] uppercase tracking-wider text-dim">
          Kanal
        </div>
        <Section items={ITEMS_CHANNEL} pathname={pathname} badges={badges} />

        <div className="mono mt-6 mb-2 px-3 text-[11px] uppercase tracking-wider text-dim">
          Account
        </div>
        <nav className="flex flex-col gap-0.5">
          <Link
            href="/studio/settings"
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground"
          >
            Einstellungen
          </Link>
        </nav>
      </aside>
    </>
  );
}

function Section({
  items,
  pathname,
  badges,
}: {
  items: Item[];
  pathname: string | null;
  badges: Record<string, number | null>;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active =
          it.href === "/studio"
            ? pathname === "/studio"
            : pathname?.startsWith(it.href);
        const badge = it.badgeKey ? badges[it.badgeKey] : null;
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
            {badge != null && badge > 0 && (
              <span className="mono rounded-full bg-brand/20 px-1.5 py-0.5 text-[10px] text-brand">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
