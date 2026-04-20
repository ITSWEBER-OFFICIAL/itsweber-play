"use client";

import { Suspense, use, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { HlsPlayer } from "@/components/hls-player";
import { videoHlsUrl, thumbnailUrl } from "@/lib/storage-urls";
import { useSearchParams } from "next/navigation";

export default function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <EmbedInner params={params} />
    </Suspense>
  );
}

function EmbedInner({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const startAt = Number(searchParams.get("t") ?? 0) || 0;

  const video = trpc.video.get.useQuery({ idOrSlug: slug });

  const recordView = trpc.video.recordView.useMutation();
  const videoId = video.data?.id;
  const status = video.data?.status;
  useEffect(() => {
    if (!videoId || status !== "LIVE") return;
    const key = `play:embed:viewed:${videoId}`;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    recordView.mutate({ id: videoId });
  }, [videoId, status]);

  if (video.isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (video.error || !video.data || video.data.status !== "LIVE") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <p className="text-sm text-white/40">Video nicht verfügbar.</p>
      </div>
    );
  }

  const v = video.data;

  return (
    <div className="h-screen w-screen bg-black">
      <HlsPlayer
        src={videoHlsUrl(v.id)}
        poster={v.thumbnailKey ? thumbnailUrl(v.thumbnailKey) : undefined}
        className="h-full w-full"
        startAt={startAt}
      />
    </div>
  );
}
