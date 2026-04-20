# Legal Templates

Ausgangs-HTML-Templates für die drei Pflichtseiten einer deutschen
Video-Plattform. Platzhalter in geschweiften Klammern (`{{...}}`)
müssen vor dem Live-Gang durch die eigenen Anbieter-Daten ersetzt
werden.

## Dateien

| Datei | Zielslug | Zweck |
|---|---|---|
| `impressum.html` | `/impressum` | Anbieter-Kennzeichnung nach § 5 TMG, MStV |
| `datenschutz.html` | `/datenschutz` | DSGVO-Erklärung |
| `agb.html` | `/agb` | Nutzungsbedingungen Multi-Creator-Plattform |

## Platzhalter

| Platzhalter | Beispiel |
|---|---|
| `{{ANBIETER_NAME}}` | Vor- und Nachname bzw. Firmenname |
| `{{ANBIETER_STRASSE}}` | Straße + Hausnummer |
| `{{ANBIETER_PLZ_ORT}}` | PLZ + Ort |
| `{{ANBIETER_LAND}}` | z. B. Deutschland |
| `{{ANBIETER_EMAIL}}` | Kontakt-E-Mail |
| `{{ANBIETER_TELEFON}}` | Kontakt-Telefon |
| `{{ANBIETER_WEBSITE}}` | Haupt-Domain ohne Schema |
| `{{PLATTFORM_NAME}}` | z. B. „ITSWEBER Play" |
| `{{PLATTFORM_DOMAIN}}` | z. B. `play.example.com` |
| `{{LEGAL_VERSION}}` | z. B. `2026-04` |

## Einbau

1. Platzhalter in den HTML-Dateien durch eigene Werte ersetzen
2. Im Admin-Panel unter **Admin → Seiten → Neu** eine Seite anlegen
3. Slug und Title entsprechend setzen (z. B. Slug `impressum`)
4. Inhalt: den finalen HTML-Quellcode einfügen (nicht den
   HTML-Kommentar am Anfang)
5. Veröffentlichen → Seite ist unter `https://<deine-domain>/<slug>`
   erreichbar, Footer-Links zeigen automatisch dorthin

Alternativ: Seed-Skript schreiben, das die drei `StaticPage`-Records
via Prisma in die DB schreibt.

## Wichtig

**Keine Rechtsberatung.** Diese Templates sind Startpunkt, keine
freigegebenen Rechtstexte. Vor dem Live-Gang sollte ein Anwalt oder
eine spezialisierte Datenschutzerklärungs-Generator-Lösung (z. B.
eRecht24 Premium, Datenschutzexperte) den konkreten Text prüfen —
insbesondere:

- Ob alle eingesetzten Drittdienste in der Datenschutzerklärung
  aufgeführt sind (z. B. Analytics, Sentry, CDN, SMTP-Dienst)
- Ob die AGB-Einbeziehung mit Checkbox bei der Registrierung
  rechtskonform umgesetzt ist
- Ob eine Cookie-Banner-Lösung mit granularer Einwilligung nötig ist
- Ob bei Firmen zusätzliche Pflichtangaben (Handelsregister,
  Umsatzsteuer-ID, Geschäftsführer) erforderlich sind
