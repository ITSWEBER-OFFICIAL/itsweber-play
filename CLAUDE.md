# CLAUDE.md — ITSWEBER Play Docker

Kontext für Claude-Sessions in diesem Projekt.

## Was ist das hier?

Greenfield-Video-Plattform als Docker-Stack. Ersetzt PeerTube + die aktuell laufende MediaCMS-Installation. Ziel: extreme optische Anpassbarkeit, Multi-Creator, Play-Studio-Backend, Stand 2026.

Host: **ITSWEBER-CORE** (Unraid 7.2.0, `192.168.0.10`)
Docker-VLAN: `br1` / `10.10.8.0/24`
Reservierte IPs: `10.10.8.50` (web) – `10.10.8.55`

## Stack (kurz)

- Frontend: Next.js 15 (App Router, RSC) + Tailwind v4 + shadcn/ui
- API: Fastify + tRPC + Better Auth + Prisma 6
- Worker: BullMQ + FFmpeg + yt-dlp
- DB: PostgreSQL 16 | Queue/Cache: Redis 7 | Blobs: MinIO
- Monorepo: pnpm + Turborepo

## Projekt-spezifische Konventionen

- **Theming-System** ist der Kern-Differenzierer. Jede UI-Entscheidung respektiert Design Tokens in `packages/theme/tokens.json`. Keine hardcodierten Farben/Abstände in Komponenten.
- **API-Grenzen**: Frontend spricht ausschließlich tRPC. Kein direkter DB-Zugriff aus Next.js-Routen.
- **Videos**: Werden IMMER über den Worker transcodiert (auch externe yt-dlp-Imports). Kein direktes Ausliefern von Original-Uploads.
- **Sichtbarkeit**: Enum `public | unlisted | private | logged_in` ist Quelle der Wahrheit — an jedem Abruf verifiziert.

## Infrastruktur-Abhängigkeiten

- **NPM** auf `192.168.0.2` (extern verwaltet, siehe `config/npm-proxy-host.md`)
- **Authentik** auf `10.10.8.13` (aktuell gestoppt, wird für späteren OIDC-Login reaktiviert)
- Zentrale Doku: `c:\Users\itswe\Documents\ITSWEBER\Projekte\Infrastruktur\ITSWEBER-CORE_Serverdoku.md`

## Nicht machen

- Kein ActivityPub / Föderation (bewusst Single-Instance)
- Keine Migration des MediaCMS-Bestands vor MVP
- Keine hardcoded Colors — alles über Tokens
- Kein GPU-Transcoding bis Frigate/CompreFace die GPU freigeben

## Project-level Skills

`.claude/skills/` enthält projektbezogen installierte Skills. Diese werden automatisch je nach Arbeitskontext genutzt — keine manuelle Aktivierung nötig.

## Second Brain

Projektnotiz: `c:\Users\itswe\Documents\ITSWEBER\Second-Brain\02 Projekte\ITSWEBER Play Docker.md`
