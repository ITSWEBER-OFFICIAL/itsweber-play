# Security Policy

## Unterstützte Versionen

Aktuell wird nur die jüngste `main`-Version aktiv gepflegt. Ältere
Tags sind Snapshots und bekommen keine Sicherheitspatches.

| Version | Unterstützt |
|---------|------------|
| `main` / `latest` | ✅ |
| < `v0.3.0` | ❌ (Beta-Vorstadium) |

## Sicherheitslücken melden

**Bitte KEINE öffentlichen GitHub-Issues für Security-Findings.**

Melde Schwachstellen direkt an:

- Mail: [security@itsweber.de](mailto:security@itsweber.de)
- PGP-Key: auf Anfrage

Erwarte eine erste Antwort innerhalb von **72 Stunden**. Ich bestätige
den Eingang und gebe einen Zeitplan für Triage und Fix. Nach dem Fix
wird die Schwachstelle über ein GitHub-Security-Advisory transparent
gemacht.

## Scope

In-Scope:

- Privilege-Escalation (Role-Enforcement, tRPC-Endpoints)
- Sichtbarkeits-Umgehung (`public | unlisted | private | logged_in`)
- Upload-Path-Traversal, Storage-Enumeration
- Session-Hijacking (Better Auth, Cookies)
- XSS in nutzergenerierten Inhalten (Titel, Beschreibungen, Kommentare)
- SSRF über yt-dlp-Import

Out-of-Scope:

- Rate-Limits auf Dev-Endpoints (`/dev/*`)
- Fehlende CSP-Header in Dev-Container (Prod-Nginx liefert sie)
- Passwörter, die der Admin selbst schwach gewählt hat

## Verantwortungsvolle Offenlegung

Bitte gib mir **mindestens 90 Tage** Zeit für Fix + Rollout, bevor du
Details veröffentlichst. Bei kritischen Findings (auth-bypass, RCE)
rolle ich schneller aus.
