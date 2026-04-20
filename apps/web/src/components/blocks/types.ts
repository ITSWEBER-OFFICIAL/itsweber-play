// Shared types for the page-block renderer. Mirrors `apps/api/trpc/routers/page.ts`
// output shape. We keep the union loose (Record<string,unknown>) because the
// block components validate their config at render-time anyway.

export type PageBlockType =
  | "HERO"
  | "VIDEO_GRID"
  | "CATEGORY_CHIPS"
  | "CTA_BANNER"
  | "SHORTS_ROW"
  | "CHANNEL_ROW"
  | "COMMUNITY_ROW";

export interface PageBlockData {
  id: string;
  pageSlug: string;
  position: number;
  type: PageBlockType;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedAt: string;
}

export interface BlockVideo {
  id: string;
  slug: string;
  title: string;
  thumbnailKey: string | null;
  durationSec: number | null;
  viewCount: number;
  publishedAt: string | Date | null;
  format?: "LONG" | "SHORT";
  channel: { slug: string; displayName: string };
}

export interface BlockChannel {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  _count: { videos: number; subscriptions: number };
}

export const BLOCK_LABELS: Record<PageBlockType, string> = {
  HERO: "Hero (Featured Video)",
  VIDEO_GRID: "Video-Grid",
  CATEGORY_CHIPS: "Kategorien-Chips",
  CTA_BANNER: "Call-to-Action-Banner",
  SHORTS_ROW: "Shorts-Reihe (9:16-Karussell)",
  CHANNEL_ROW: "Kanal-Empfehlungen",
  COMMUNITY_ROW: "Community-Posts",
};
