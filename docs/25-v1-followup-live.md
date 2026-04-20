# v1.1 Follow-Up: Live-Chat & Premieres (Voll-Stack)

ITSWEBER Play v0.4 enthält **keine** Live-Streaming- oder Premieres-Funktionen.
Diese Entscheidung ist bewusst — Live benötigt Infrastruktur, die neben dem
VOD-Stack steht (RTMP/WHIP-Ingest, sub-second HLS-LL, Chat-Broadcaster).
Scheduled-Publish in v0.4 ist ein **asynchroner Flip** auf `visibility=PUBLIC`,
keine Live-Premiere.

## Scope v1.1 (geplant, nicht verbindlich)

1. **Ingest-Node**: MediaMTX oder nginx-rtmp auf eigenem Unraid-Container (`play-rtmp`, `10.10.8.56`).
2. **Protokolle**: RTMP-Ingest (OBS), WebRTC-WHIP-Ingest (Browser-Go-Live).
3. **Delivery**: HLS-Low-Latency (Part-Request, 1–2 s Glass-to-Glass). Optional WebRTC-WHEP für < 500 ms.
4. **Chat**: Eigener WebSocket-Service (Fastify-WS) mit Redis-Pub/Sub, Moderation-Hooks (Auto-Mute, Slow-Mode), Super-Chat-Stub via `Reaction`-Model.
5. **Storage**: Live-Recording flippt am Ende zu einem normalen VOD-Video (Transcode-Worker pickt die aufgezeichnete `.ts`-Serie auf).
6. **Premieres**: Kombi aus Scheduled-Publish + synchronisierter Playback-Time. Alle Viewer sehen denselben Abspielzeitpunkt, Chat ist aktiv.

## Warum nicht v1

- CPU/Bandwidth-Profil divergiert stark vom VOD-Transcode-Profil.
- Rechtliche Unschärfe (Live-Streaming deutscher Creator → Vorab-Check Jugendmedienschutz, EU-DSA Artikel 14).
- Chat-Moderation braucht andere Tooling-Klasse (Slow-Mode, Super-Chat, Raid-Detect) als Comment-Moderation.
- Netzwerk: öffentlicher RTMP-Port via NPM nicht empfohlen — dedizierter TCP-Port nötig.

## Abhängigkeiten für die v1.1-Session

- Neuer Container `play-rtmp` im Docker-Compose (separate Service, kein depends_on auf Web/API).
- DB-Migration: neue Entities `LiveStream`, `StreamKey`, `LiveChatMessage`.
- tRPC-Router `live.*` mit `start/stop/stats/chat`.
- Neuer Worker-Queue `live-archive` (flippt Recording-Segments in VOD).
- Neuer Frontend-Modus `/live/[slug]` mit LL-HLS-Player + Chat-Sidebar.
- Admin-Feature-Flag `LIVE_ENABLED` in `siteSettings`.

## Referenzen

- MediaMTX: https://github.com/bluenviron/mediamtx
- WHIP (WebRTC-HTTP Ingest Protocol): RFC 8848
- HLS Low-Latency: Apple Spec HTTP Live Streaming 2nd Edition
