# 01 — Architektur

## Container-Topologie

```text
                       Internet
                          │
                          ▼
                  ┌───────────────┐
                  │ Reverse-Proxy │  <PROXY-HOST>
                  │ Let's Encrypt │
                  └───────┬───────┘
                          │  (play.example.com)
                          ▼
        ┌─────────────────────────────────────────┐
        │  play-web   (Next.js 15 SSR)            │  :3000
        │  - Public Routes                        │
        │  - /studio (Creator-Backend)            │
        │  - /admin (Admin-Panel + Theme-Editor)  │
        └──────────────┬──────────────────────────┘
                       │  tRPC / HTTP
                       ▼
        ┌─────────────────────────────────────────┐
        │  play-api  (Fastify + Better Auth)      │  :4000
        │  - /trpc/*                              │
        │  - /auth/*                              │
        │  - /upload/* (tus.io resumable)         │
        │  - /hls/signed-url/:id                  │
        └──┬───────────┬────────────┬─────────────┘
           │           │            │
           ▼           ▼            ▼
    ┌─────────┐  ┌──────────┐  ┌─────────────┐
    │postgres │  │  redis   │  │   minio     │
    │  :5432  │  │  :6379   │  │  :9000      │
    │ Prisma  │  │ BullMQ + │  │ S3 API      │
    │         │  │ Sessions │  │ Videos+Thumb│
    └─────────┘  └────┬─────┘  └─────────────┘
                      │
                      ▼ Job Dequeue
              ┌───────────────────┐
              │  play-worker      │  (internal)
              │  FFmpeg + yt-dlp  │
              │  BullMQ Consumer  │
              └───────────────────┘
```

Die konkreten Container-Adressen kommen aus der Deployment-Konfiguration
(siehe `docker-compose.yml` bzw. Unraid-/Kubernetes-spezifische Varianten).
Die All-in-One-Variante verwendet `127.0.0.1` + s6-overlay statt
separate Container.

## Datenfluss: Upload

```text
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

```text
Better Auth (eigene User-DB)
   ├── Email/Passwort (default)
   ├── Passkey (WebAuthn) — später
   └── OIDC Plugin (später aktivierbar):
        └── Issuer: dein OIDC-Provider (z. B. Authentik, Keycloak)
```

Sessions: Cookie-based, HTTP-only, `SameSite=Lax`. Über
`AUTH_COOKIE_DOMAIN` konfigurierbar (Punkt-Prefix erlaubt
SSO-Cookie-Sharing über Subdomains).

## Theming-Architektur

Siehe `03-theming.md` — kurz:
- Tokens → CSS-Variablen in `<head>` injected
- Admin-Änderung patcht DB + sendet WS-Event → Frontend ersetzt `<style id="theme-vars">` live

## Deployment-Modell

- Single-Host oder Single-Container (All-in-One)
- Keine Orchestrierung nötig (kein Swarm/k8s)
- Zero-Downtime-Updates via `docker compose up -d --build` (rolling)
- DB-Migrations in Prisma, werden im API-Entrypoint ausgeführt

## Performance-Annahmen

- Zielgruppe: kleine bis mittlere Community (≤ 100 gleichzeitige Viewer)
- Transcoding: ≤ 3 parallele Jobs (CPU), Queue puffert Rest
- Storage-Wachstum: stark abhängig von Upload-Rate, plane ≥ 100 GB initial
