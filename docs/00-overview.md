# 00 — Overview

## Warum dieses Projekt?

PeerTube (eingestellt) und die aktuelle MediaCMS-Installation (seit 31.03.2026 auf `play.itsweber.net`) erfüllen den Kernanspruch nicht: **maximale optische Anpassbarkeit**. Beide Systeme bringen starre Frontends, deren CSS-Überschreibung brüchig ist und bei Updates verloren gehen kann.

**ITSWEBER Play** ist eine Greenfield-Neuentwicklung, in der das Theming-System von Anfang an als First-Class-Feature gebaut wird — nicht als nachträgliche Kosmetik.

## Zielbild

- Eigene Video-Plattform auf Unraid (`ITSWEBER-CORE`)
- Multi-Creator: Registrierung + Upload für jeden User
- Play Studio (User-Backend): einfache Video-Bearbeitung, Analytics, Kanal-Anpassung
- Admin-Theme-Editor mit Live-Preview
- YouTube/Vimeo-Import via `yt-dlp` als eigene Kopie
- Standard 2026 (React Server Components, tRPC, Better Auth, HLS adaptive)

## Non-Goals

- Keine Föderation (ActivityPub) — bewusst Single-Instance
- Keine Migration des MediaCMS-Bestands vor MVP
- Kein öffentliches Paywall-/Monetarisierungssystem in v1
- Keine native Mobile-App in v1 (PWA reicht)

## Erfolgsmetriken (MVP)

1. Upload → Playback < 5 min Latenz (für 10-min 1080p-Video)
2. Theme-Änderung im Admin sichtbar < 1 s (Live-Preview)
3. Alle 4 Sichtbarkeits-Modi funktionieren deterministisch
4. 10 Videos parallel uploadbar ohne Stall

## Stakeholder

- **Owner**: ITSWEBER (Solo)
- **Nutzer**: ITSWEBER selbst + freigeschaltete Creator (zu Beginn wie MediaCMS: 3 Accounts)
- **Infra**: Unraid-Server `ITSWEBER-CORE`

## Abgrenzung zu verwandten Projekten

| Projekt | Status | Beziehung |
|---|---|---|
| PeerTube | gestoppt | Alt-System, wird abgebaut |
| MediaCMS (aktuelles ITSWEBER Play) | läuft | Parallel bis Migration — danach abgebaut |
| Authentik | gestoppt | Wird für OIDC-Login (v1) reaktiviert |
| Emby | läuft | Unabhängig — keine Überschneidung (privater Film-Server) |
