// Urheber-Konstanten — Single Source of Truth.
//
// Struktur:
//   PRODUKT      = "ITSWEBER Play"           (die Plattform selbst)
//   PRODUKT-URL  = https://play.itsweber.net (öffentliche Instanz)
//   URHEBER      = "ITSWEBER" / Benjamin Weber
//   URHEBER-URL  = https://itsweber.de       (Firmen-Site)
//
// WICHTIG: Diese Werte sind Teil der Software-Identität. Sie werden im Footer,
// in den HTML-Meta-Tags, im Admin-Panel und in der package.json referenziert.
// SiteSettings kann `siteName` und `siteTagline` für das Marketing-Branding
// ändern (eine Fork-Instanz kann sich anders nennen), aber NICHT die
// Urheberschaft des Systems selbst verschleiern.
//
// Lizenz: AGPL-3.0 — Attributierungspflicht. Wer die Software weitergibt oder
// hosted, muss diesen Hinweis erhalten. Das Entfernen der
// "ITSWEBER Play — powered by ITSWEBER"-Zeile verletzt die Lizenz.
//
// © Benjamin Weber / ITSWEBER — https://itsweber.de

export const APP_NAME = "ITSWEBER Play" as const;
export const APP_VERSION = "v0.4.0-dev" as const;
export const PRODUCT_HOMEPAGE = "https://play.itsweber.net" as const;

export const VENDOR_NAME = "ITSWEBER" as const;
export const VENDOR_URL = "https://itsweber.de" as const;
export const AUTHOR_NAME = "Benjamin Weber" as const;
export const AUTHOR_URL = "https://itsweber.de" as const;

export const COPYRIGHT_NOTICE =
  `© ${new Date().getFullYear()} ${AUTHOR_NAME} · ${VENDOR_NAME}` as const;
