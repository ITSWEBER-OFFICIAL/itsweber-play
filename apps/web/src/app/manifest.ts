import type { MetadataRoute } from "next";

// PWA-Manifest für ITSWEBER Play. Next.js 15 App-Router-native Route — wird
// unter /manifest.webmanifest ausgeliefert und automatisch verlinkt.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ITSWEBER Play",
    short_name: "Play",
    description: "Der etwas andere Video-Hub.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1A26",
    theme_color: "#0A1A26",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
