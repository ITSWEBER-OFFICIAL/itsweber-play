import type { Metadata } from "next";
import { WatchPageClient } from "./watch-client";
import { thumbnailUrl, videoHlsUrl } from "@/lib/storage-urls";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "ITSWEBER Play";

interface VideoMeta {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailKey: string | null;
  durationSec: number | null;
  publishedAt: string | null;
  viewCount: number;
  channel: { slug: string; displayName: string };
}

async function fetchVideoMeta(slug: string): Promise<VideoMeta | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${apiUrl}/api/trpc/video.get?input=${encodeURIComponent(JSON.stringify({ idOrSlug: slug }))}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json() as { result?: { data?: VideoMeta } };
    return json?.result?.data ?? null;
  } catch {
    return null;
  }
}

function secsToIso8601(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `PT${h}H${m}M${s}S`;
  if (m > 0) return `PT${m}M${s}S`;
  return `PT${s}S`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = await fetchVideoMeta(slug);

  if (!video) {
    return {
      title: "Video nicht gefunden – " + SITE_NAME,
    };
  }

  const title = video.title;
  const description = video.description
    ? video.description.slice(0, 160)
    : `Schau dir "${title}" auf ${SITE_NAME} an.`;
  const thumb = video.thumbnailKey ? thumbnailUrl(video.thumbnailKey) : undefined;
  const watchUrl = `${SITE_URL}/watch/${slug}`;
  const embedUrl = `${SITE_URL}/embed/${slug}`;
  const oEmbedUrl = `${SITE_URL}/api/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  return {
    title: `${title} – ${SITE_NAME}`,
    description,
    alternates: {
      types: {
        "application/json+oembed": oEmbedUrl,
      },
    },
    openGraph: {
      type: "video.other",
      siteName: SITE_NAME,
      title,
      description,
      url: watchUrl,
      ...(thumb && { images: [{ url: thumb, width: 1280, height: 720 }] }),
      videos: [
        {
          url: videoHlsUrl(video.id),
          type: "application/x-mpegURL",
          width: 1280,
          height: 720,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(thumb && { images: [thumb] }),
    },
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = await fetchVideoMeta(slug);

  const jsonLd = video
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: video.title,
        description: video.description ?? undefined,
        thumbnailUrl: video.thumbnailKey
          ? thumbnailUrl(video.thumbnailKey)
          : undefined,
        uploadDate: video.publishedAt ?? undefined,
        contentUrl: videoHlsUrl(video.id),
        embedUrl: `${SITE_URL}/embed/${video.slug}`,
        duration: video.durationSec ? secsToIso8601(video.durationSec) : undefined,
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: { "@type": "WatchAction" },
          userInteractionCount: video.viewCount,
        },
        author: {
          "@type": "Person",
          name: video.channel.displayName,
          url: `${SITE_URL}/c/${video.channel.slug}`,
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <WatchPageClient params={params} />
    </>
  );
}
