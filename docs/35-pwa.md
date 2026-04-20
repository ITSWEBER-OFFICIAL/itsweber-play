# PWA — Progressive Web App

Stand Session K. ITSWEBER Play kann auf Desktop und Mobile als App installiert
werden. Kein Service-Worker in v0.4 — Cache-Strategie kommt mit v0.5.

## Manifest

Datei: [apps/web/src/app/manifest.ts](../apps/web/src/app/manifest.ts)

Next.js 15 App-Router-Route. Wird automatisch unter `/manifest.webmanifest`
ausgeliefert und per `<link rel="manifest">` verlinkt.

```ts
{
  name: "ITSWEBER Play",
  short_name: "Play",
  start_url: "/",
  display: "standalone",
  background_color: "#0A1A26", // ITSWEBER Navy
  theme_color: "#0A1A26",
  lang: "de",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}
```

## Web-Vitals

Component: [apps/web/src/components/web-vitals.tsx](../apps/web/src/components/web-vitals.tsx)

- `useReportWebVitals` aus `next/web-vitals` registriert einen Reporter, der
  bei jedem LCP/CLS/INP/FCP/TTFB-Event `navigator.sendBeacon` nach
  `/api/analytics/web-vitals` POSTet (Fallback: `fetch(..., keepalive: true)`).
- API-Endpoint in [apps/api/src/server.ts](../apps/api/src/server.ts) loggt den
  Vital via Pino (`app.log.info({ webVital })`) und antwortet `204`.
- Aggregation: Logs können in Loki/Promtail ausgewertet werden.

## Offline-Story (v0.5+)

- Service-Worker via `next-pwa` oder Custom `src/sw.ts`.
- Strategie:
  - `CacheFirst` für `/icons/*`, `/_next/static/*`.
  - `NetworkFirst` für Pages, mit 5-s-Timeout und Offline-Fallback auf `/offline`.
  - Kein Caching von `/watch/*` (Video-Lizenz/Authz-Risiko).

## Install-Prompt

Chrome zeigt das Install-Prompt automatisch nach ca. 30 s Engagement. Kein
benutzerdefinierter Prompt nötig in v0.4 — Browser-UI ist Standard.
