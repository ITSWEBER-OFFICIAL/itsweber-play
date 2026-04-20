import { NextRequest, NextResponse } from "next/server";
import { thumbnailUrl } from "@/lib/storage-urls";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PROVIDER_NAME = "ITSWEBER Play";

interface VideoMeta {
  id: string;
  slug: string;
  title: string;
  thumbnailKey: string | null;
  channel: { slug: string; displayName: string };
}

async function fetchVideoBySlug(slug: string): Promise<VideoMeta | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/trpc/video.get?input=${encodeURIComponent(JSON.stringify({ idOrSlug: slug }))}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const json = await res.json() as { result?: { data?: VideoMeta } };
    return json?.result?.data ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  // Extract slug from watch URL: {SITE_URL}/watch/{slug}
  let slug: string | null = null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/watch\/([^/]+)/);
    if (match) slug = match[1] ?? null;
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (!slug) {
    return NextResponse.json({ error: "not a video url" }, { status: 404 });
  }

  const video = await fetchVideoBySlug(slug);
  if (!video) {
    return NextResponse.json({ error: "video not found" }, { status: 404 });
  }

  const thumb = video.thumbnailKey ? thumbnailUrl(video.thumbnailKey) : undefined;
  const embedUrl = `${SITE_URL}/embed/${video.slug}`;
  const channelUrl = `${SITE_URL}/c/${video.channel.slug}`;

  const response = {
    type: "video",
    version: "1.0",
    title: video.title,
    author_name: video.channel.displayName,
    author_url: channelUrl,
    provider_name: PROVIDER_NAME,
    provider_url: SITE_URL,
    width: 1280,
    height: 720,
    html: `<iframe src="${embedUrl}" width="1280" height="720" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`,
    ...(thumb && {
      thumbnail_url: thumb,
      thumbnail_width: 1280,
      thumbnail_height: 720,
    }),
  };

  return NextResponse.json(response, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
