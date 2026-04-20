"use client";

import { HeroBlock } from "./hero-block";
import { VideoGridBlock } from "./video-grid-block";
import { CategoryChipsBlock } from "./category-chips-block";
import { CtaBannerBlock } from "./cta-banner-block";
import { ShortsRowBlock } from "./shorts-row-block";
import { ChannelRowBlock } from "./channel-row-block";
import { CommunityRowBlock } from "./community-row-block";
import type { BlockChannel, BlockVideo, PageBlockData } from "./types";

// Resolves a block's data dependencies from the flat lists the homepage
// already fetches. Keeping the block components pure (no tRPC hooks inside)
// makes them reusable for the admin preview iframe and unit tests.
//
// `videos` enthält LONG-Form-Videos. `shorts` enthält Format=SHORT-Videos.
// `channels` ist optional — wird nur für CHANNEL_ROW gebraucht.

export function BlockRenderer({
  block,
  videos,
  shorts,
  channels,
  featuredVideo,
}: {
  block: PageBlockData;
  videos: BlockVideo[];
  shorts?: BlockVideo[];
  channels?: BlockChannel[];
  featuredVideo: BlockVideo | null;
}) {
  switch (block.type) {
    case "HERO": {
      const cfg = block.config as {
        videoSlug?: string | null;
        badgeLabel?: string;
        ctaLabel?: string;
      };
      const target = cfg.videoSlug
        ? videos.find((v) => v.slug === cfg.videoSlug) ?? null
        : featuredVideo;
      return <HeroBlock config={cfg} video={target} />;
    }
    case "VIDEO_GRID": {
      const cfg = block.config as {
        title?: string;
        badgeLabel?: string | null;
        orderBy?: "latest" | "mostViewed";
        limit?: number;
        format?: "ALL" | "LONG" | "SHORT";
        skipFeatured?: boolean;
      };
      const formatFilter = cfg.format ?? "LONG";
      let list = videos.slice();
      if (formatFilter === "SHORT" && shorts) {
        list = shorts.slice();
      } else if (formatFilter === "ALL" && shorts) {
        list = [...videos, ...shorts];
      } else if (formatFilter === "LONG") {
        // Falls videos das mixed-Array ist, defensive filtern.
        list = list.filter((v) => v.format === undefined || v.format === "LONG");
      }
      if (cfg.skipFeatured !== false && featuredVideo) {
        list = list.filter((v) => v.id !== featuredVideo.id);
      }
      if (cfg.orderBy === "mostViewed") {
        list.sort((a, b) => b.viewCount - a.viewCount);
      }
      return <VideoGridBlock config={cfg} videos={list.slice(0, cfg.limit ?? 12)} />;
    }
    case "CATEGORY_CHIPS":
      return <CategoryChipsBlock config={block.config as { items?: string[] }} />;
    case "CTA_BANNER":
      return <CtaBannerBlock config={block.config as Record<string, string>} />;
    case "SHORTS_ROW":
      return (
        <ShortsRowBlock
          config={block.config as Parameters<typeof ShortsRowBlock>[0]["config"]}
          videos={shorts ?? []}
        />
      );
    case "CHANNEL_ROW":
      return (
        <ChannelRowBlock
          config={block.config as Parameters<typeof ChannelRowBlock>[0]["config"]}
          channels={channels ?? []}
        />
      );
    case "COMMUNITY_ROW":
      return (
        <CommunityRowBlock
          config={block.config as Parameters<typeof CommunityRowBlock>[0]["config"]}
        />
      );
    default:
      return null;
  }
}
