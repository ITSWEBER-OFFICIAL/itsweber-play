import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface VideoEntry {
  slug: string;
  publishedAt: string | null;
}

interface ChannelEntry {
  slug: string;
}

async function fetchPublicVideos(): Promise<VideoEntry[]> {
  try {
    const input = JSON.stringify({ limit: 1000, visibility: "PUBLIC", status: "LIVE" });
    const res = await fetch(
      `${API_URL}/api/trpc/video.list?input=${encodeURIComponent(input)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const json = await res.json() as { result?: { data?: VideoEntry[] } };
    return json?.result?.data ?? [];
  } catch {
    return [];
  }
}

async function fetchPublicChannels(): Promise<ChannelEntry[]> {
  try {
    const input = JSON.stringify({ limit: 500 });
    const res = await fetch(
      `${API_URL}/api/trpc/channel.list?input=${encodeURIComponent(input)}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return [];
    const json = await res.json() as { result?: { data?: ChannelEntry[] } };
    return json?.result?.data ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [videos, channels] = await Promise.all([
    fetchPublicVideos(),
    fetchPublicChannels(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/channels`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/shorts`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/impressum`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/datenschutz`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/agb`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const videoRoutes: MetadataRoute.Sitemap = videos.map((v) => ({
    url: `${SITE_URL}/watch/${v.slug}`,
    lastModified: v.publishedAt ? new Date(v.publishedAt) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  const channelRoutes: MetadataRoute.Sitemap = channels.map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...videoRoutes, ...channelRoutes];
}
