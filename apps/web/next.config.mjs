/** @type {import('next').NextConfig} */

// MinIO liefert bereits dimensionierte .webp-Thumbnails — Next.js Image-
// Optimization wäre redundant und scheitert in Same-Origin-Setups (S3_PUBLIC_URL
// ist im All-in-One ein relativer Pfad "/s3", nicht parsebar als URL). Mit
// `unoptimized: true` wird `<Image>` zum normalen <img> ohne /_next/image-Hop.
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@play/shared"],
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
