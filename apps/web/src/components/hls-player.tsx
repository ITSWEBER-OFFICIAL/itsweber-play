"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

export function HlsPlayer({
  src,
  poster,
  className,
  startAt = 0,
  loop = false,
  autoPlay = false,
  muted = false,
}: {
  src: string;
  poster?: string;
  className?: string;
  startAt?: number;
  loop?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const applyStartAt = () => {
      if (startAt > 0) video.currentTime = startAt;
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", applyStartAt, { once: true });
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.once(Hls.Events.MANIFEST_PARSED, applyStartAt);
      return () => {
        hls.destroy();
      };
    }

    video.src = src;
    video.addEventListener("loadedmetadata", applyStartAt, { once: true });
  }, [src, startAt]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      loop={loop}
      autoPlay={autoPlay}
      muted={muted}
      poster={poster}
      className={className ?? "aspect-video w-full rounded-lg bg-black"}
    />
  );
}
