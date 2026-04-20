# 00 — Overview

## Warum dieses Projekt?

PeerTube und MediaCMS liefern Video-Plattform-Grundfunktionen — aber beide
bringen starre Frontends, deren CSS-Überschreibung brüchig ist und bei
Updates verloren gehen kann.

**Play** ist eine Greenfield-Neuentwicklung, in der das Theming-System
von Anfang an als First-Class-Feature gebaut ist — nicht als
nachträgliche Kosmetik.

## Zielbild

- Selbst-gehostete Video-Plattform als Single-Container-Docker-Stack
- Multi-Creator: Registrierung + Upload für jeden User
- Play Studio (User-Backend): einfache Video-Bearbeitung, Analytics, Kanal-Anpassung
- Admin-Theme-Editor mit Live-Preview
- YouTube/Vimeo-Import via `yt-dlp` als eigene Kopie
- Standard 2026 (React Server Components, tRPC, Better Auth, HLS adaptive)

## Non-Goals

- Keine Föderation (ActivityPub) — bewusst Single-Instance
- Kein öffentliches Paywall-/Monetarisierungssystem in v1
- Keine native Mobile-App in v1 (PWA reicht)

## Erfolgsmetriken (MVP)

1. Upload → Playback < 5 min Latenz (für 10-min 1080p-Video)
2. Theme-Änderung im Admin sichtbar < 1 s (Live-Preview)
3. Alle 4 Sichtbarkeits-Modi funktionieren deterministisch
4. 10 Videos parallel uploadbar ohne Stall

## Zielgruppe

- Einzelpersonen, Familien, kleine Communities, die eine eigene
  Video-Plattform ohne YouTube/Vimeo-Abhängigkeit wollen
- Selbst-Hoster auf Unraid, Synology, NAS, Hetzner, Linux-VM
- Betreiber, die TLS/Reverse-Proxy und Docker bedienen können

## Abgrenzung zu verwandten Projekten

| Projekt | Beziehung |
|---|---|
| PeerTube | Ähnliche Ziele, aber Federation-first und weniger Theming-flexibel |
| MediaCMS | Ältere Alternative, Python-basiert, geringere Frontend-Flexibilität |
| YouTube / Vimeo | Kommerziell, nicht selbst-hostbar |
