# 10 — Migration von MediaCMS

**Ausgangslage:** Bestehende MediaCMS-Installation läuft unter `play.itsweber.net`, 3 Benutzer (Admin, ITSWEBER Offiziell, KG Roter Kaul). Teal-Light-Theme, Custom-Startseite.

**Ziel:** Inhalte + User ohne Datenverlust auf ITSWEBER Play übertragen.

## Strategie

Zweistufig:
1. **Parallelbetrieb** während gesamter Entwicklung (MediaCMS bleibt Prod, Play Next läuft auf `play-next.itsweber.net`)
2. **Cutover** erst bei v1 — kontrollierter Moment, User werden informiert

## Was wird migriert?

| Asset | Quelle (MediaCMS) | Ziel (Play) | Anmerkung |
|---|---|---|---|
| User-Accounts | Django User DB | Prisma User + passwort-reset | Passwörter nicht übertragbar (Hash-Schemata unterschiedlich) — Reset-Flow |
| Kanäle | MediaCMS User-Kanal | 1:1 pro User auto | |
| Video-Dateien | MediaCMS AppData | MinIO `play-videos/` | über FFmpeg-Transcode-Pipeline (Re-Processing) |
| Metadaten (Titel, Beschreibung, Tags) | MediaCMS DB | Prisma Video | via Import-Script |
| Kommentare | MediaCMS DB | Prisma Comment | optional — Diskussionswert gering |
| Views / Likes | MediaCMS DB | — | NICHT migriert (Counter-Reset akzeptiert) |
| Playlists | MediaCMS | Prisma Playlist | optional |

## Migrations-Script (im v1-Scope)

Ort: `scripts/migrate-from-mediacms.ts`

Ablauf:
1. MediaCMS via interner REST-API abfragen (oder Django-DB-Dump lesen)
2. Pro Video: Download Original → in Play `upload.completeUpload`-Flow einhängen → Worker transcodiert neu
3. User anlegen, Verify-Status setzen, Password-Reset-Mail automatisch verschicken

## Cutover-Checkliste

- [ ] Alle Videos migriert und als `public`/`unlisted` (je nach Original) gesetzt
- [ ] User informiert (Mail + Banner in MediaCMS 1 Woche vorher)
- [ ] Passwort-Reset-Links verschickt
- [ ] DNS-Wechsel vorbereiten (NPM Proxy Host umstellen)
- [ ] Monitoring: 24h engmaschig
- [ ] MediaCMS-Container auf `read-only` (keine neuen Uploads)
- [ ] Nach 1 Woche Stabilität: MediaCMS stoppen, AppData archivieren nach `/mnt/user/Backup/mediacms-final/`

## Rollback

DNS-Wechsel ist sofort zurückrollbar (NPM Proxy Host Forward-IP tauschen). MediaCMS läuft weiter bis AppData-Archivierung.

## Offene Fragen für den Migrationszeitpunkt

- MediaCMS-Version dokumentieren, falls API-Endpoints sich ändern
- Originalvideo-Dateien in `/mnt/user/appdata/mediacms/` verorten
- Disk-Platz prüfen: temporär doppelter Storage-Bedarf während Migration
