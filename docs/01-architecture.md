# 01 — Architektur

## Container-Topologie

```
                       Internet
                          │
                          ▼
                  ┌───────────────┐
                  │  NPM (NGINX)  │  192.168.0.2
                  │  Let's Encrypt│
                  └───────┬───────┘
                          │  (play.itsweber.net)
                          ▼
        ┌─────────────────────────────────────────┐
        │  play-web   (Next.js 15 SSR)            │  10.10.8.50:3000
        │  - Public Routes                        │
        │  - /studio (Creator-Backend)            │
        │  - /admin (Admin-Panel + Theme-Editor)  │
        └──────────────┬──────────────────────────┘
                       │  tRPC / HTTP
                       ▼
        ┌─────────────────────────────────────────┐
        │  play-api  (Fastify + Better Auth)      │  10.10.8.51:4000
        │  - /trpc/*                              │
        │  - /auth/*                              │
        │  - /upload/* (tus.io resumable)         │
        │  - /hls/signed-url/:id                  │
        └──┬───────────┬────────────┬─────────────┘
           │           │            │
           ▼           ▼            ▼
    ┌─────────┐  ┌──────────┐  ┌─────────────┐
    │postgres │  │  redis   │  │   minio     │
    │  10.8.52│  │ 10.8.53  │  │  10.8.54    │
    │ Prisma  │  │ BullMQ + │  │ S3 API      │
    │         │  │ Sessions │  │ Videos+Thumb│
    └─────────┘  └────┬─────┘  └─────────────┘
                      │
                      ▼ Job Dequeue
              ┌───────────────────┐
              │  play-worker      │  (keine eigene IP)
              │  FFmpeg + yt-dlp  │
              │  BullMQ Consumer  │
              └───────────────────┘
```

## Datenfluss: Upload

```
Browser          play-web          play-api          MinIO         play-worker
  │                │                  │                │                │
  │── drag&drop ──►│                  │                │                │
  │                │── tus init ─────►│                │                │
  │                │                  │── multipart ──►│                │
  │─── chunks ────►│─────────────────►│                │                │
  │                │                  │─ enqueue job ──────────────────►│
  │                │◄── videoId (processing)           │                │
  │                │                  │                │                │
  │                │                  │                │◄─ pull orig. ──│
  │                │                  │                │                │ transcode
  │                │                  │                │                │ (ffmpeg HLS)
  │                │                  │                │◄─ push HLS ────│
  │                │                  │◄── progress (Redis pub/sub) ────│
  │◄─ WS update ──│                  │                │                │
  │                │                  │◄── done ────────────────────────│
  │◄─ status live │                  │                │                │
```

## Datenfluss: External Link Import

Exakt wie Upload, aber Source ist `yt-dlp`:
1. User fügt YouTube-URL im Studio ein
2. `play-api` erstellt Video-DB-Eintrag mit `source=external`, `status=importing`
3. Worker läuft `yt-dlp --best` → speichert lokal → transkodiert → HLS
4. Video wird sichtbar, default `visibility=private` (Urheberrechtshinweis)

## Auth-Architektur

```
Better Auth (eigene User-DB)
   ├── Email/Passwort (default)
   ├── Passkey (WebAuthn) — später
   └── OIDC Plugin (später aktivierbar):
        └── Issuer: https://auth.itsweber.net (Authentik)
```

Sessions: Cookie-based, HTTP-only, `SameSite=Lax`, Domain `.itsweber.net` (für zukünftiges SSO über Subdomains).

## Theming-Architektur

Siehe `03-theming.md` — kurz:
- Tokens → CSS-Variablen in `<head>` injected
- Admin-Änderung patcht DB + sendet WS-Event → Frontend ersetzt `<style id="theme-vars">` live

## Deployment-Modell

- Single Unraid-Host, alle Container auf `br1`
- Keine Orchestrierung (kein Swarm/k8s)
- Zero-Downtime-Updates via `docker compose up -d --build` (rolling)
- DB-Migrations in Prisma, werden im API-Entrypoint ausgeführt

## Performance-Annahmen

- Zielgruppe: ≤ 100 gleichzeitige Viewer (Familie + Bekannte)
- Transcoding: ≤ 3 parallele Jobs (CPU), Queue puffert Rest
- Storage-Wachstum: ~10 GB/Woche erwartet
