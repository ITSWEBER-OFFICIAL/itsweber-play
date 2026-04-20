import type { Metadata } from "next";
import { ChannelPageClient } from "./channel-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "ITSWEBER Play";

interface ChannelMeta {
  slug: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
}

async function fetchChannelMeta(slug: string): Promise<ChannelMeta | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const res = await fetch(
      `${apiUrl}/api/trpc/channel.getBySlug?input=${encodeURIComponent(JSON.stringify({ slug }))}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const json = await res.json() as { result?: { data?: { channel?: ChannelMeta } } };
    const ch = json?.result?.data?.channel;
    if (!ch) return null;
    return { slug: ch.slug, displayName: ch.displayName, description: ch.description, avatarUrl: ch.avatarUrl };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const channel = await fetchChannelMeta(slug);

  if (!channel) {
    return { title: "Kanal nicht gefunden – " + SITE_NAME };
  }

  const title = `${channel.displayName} – ${SITE_NAME}`;
  const description = channel.description
    ? channel.description.slice(0, 160)
    : `Alle Videos von ${channel.displayName} auf ${SITE_NAME}.`;

  return {
    title,
    description,
    openGraph: {
      type: "profile",
      siteName: SITE_NAME,
      title,
      description,
      url: `${SITE_URL}/c/${slug}`,
      ...(channel.avatarUrl && {
        images: [{ url: channel.avatarUrl, width: 400, height: 400 }],
      }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(channel.avatarUrl && { images: [channel.avatarUrl] }),
    },
  };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <ChannelPageClient params={params} />;
}
