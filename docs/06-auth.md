# 06 — Auth & Authorization

## Identity Provider

**v0 (MVP):** Better Auth mit eigener User-DB (PostgreSQL).
**v1:** Zusätzlich Authentik-OIDC als optionaler Login-Provider.

## User-Modell (Prisma-Schema Ausschnitt)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified Boolean  @default(false)
  passwordHash  String?
  handle        String   @unique          // @username, eindeutig, URL-safe
  displayName   String
  avatarUrl     String?
  role          Role     @default(CREATOR)
  createdAt     DateTime @default(now())
  banned        Boolean  @default(false)
  channels      Channel[]
  videos        Video[]
  sessions      Session[]
  oidcAccounts  OidcAccount[]  // für späteren OIDC-Link
}

enum Role {
  ADMIN
  MODERATOR
  CREATOR
  VIEWER
}
```

## Registrierung

1. `POST /auth/register` mit `{email, password, handle, displayName}`
2. Better Auth hasht Passwort (argon2id)
3. Verify-Mail wird versendet (später via Postfix-Relay Container, MVP: log-only)
4. User mit `emailVerified=false` kann **nicht** uploaden, nur schauen
5. `GET /auth/verify?token=…` setzt `emailVerified=true`
6. Auto-Erstellung eines Default-Kanals `@handle`

## Login

- Email + Passwort (default)
- Cookie `auth.session-token` (HTTP-only, Secure, `SameSite=Lax`, `Domain=.itsweber.net`)
- Session-Row in DB (rotation bei Refresh)
- Ablauf: 30 Tage sliding

## Rollen & Berechtigungen

| Aktion | Viewer | Creator | Moderator | Admin |
|---|:-:|:-:|:-:|:-:|
| Public-Videos schauen | ✅ | ✅ | ✅ | ✅ |
| Logged-in-Videos schauen | ❌ | ✅ | ✅ | ✅ |
| Kommentieren / Liken | ❌ | ✅ | ✅ | ✅ |
| Eigene Videos hochladen/editieren | ❌ | ✅ | ✅ | ✅ |
| Fremde Videos moderieren | ❌ | ❌ | ✅ | ✅ |
| User sperren | ❌ | ❌ | ✅ | ✅ |
| Theme bearbeiten | ❌ | ❌ | ❌ | ✅ |
| Blocks/Startseite bearbeiten | ❌ | ❌ | ❌ | ✅ |

**Default-Rolle bei Registrierung:** `CREATOR` (Multi-User-Upload-Vorgabe).
Admin kann Rollen frei zuweisen.

## Authentik-OIDC (v1)

Voraussetzung: Authentik-Container wieder aktiv auf `auth.itsweber.net`.

**Setup (Admin-UI im Admin-Panel):**
1. Admin trägt ein: Issuer-URL, Client-ID, Client-Secret
2. Button „OIDC aktivieren" → Login-Screen zeigt zusätzlich „Mit ITSWEBER SSO anmelden"

**Flow:**
1. User klickt SSO-Button → Authorization Code Flow → Authentik-Login
2. Callback trägt `email`, `preferred_username`, `sub` ein
3. Match per Email zu bestehendem User ODER neuer Account mit Rolle `CREATOR`
4. `OidcAccount`-Row verknüpft `sub` zu `User.id`
5. Ab dann entweder Login-Methode nutzbar

**Account-Linking:** Eingeloggter User kann in den Settings „OIDC-Account verknüpfen" triggern.

## Sicherheitsmaßnahmen

- Passwort-Policy: min 10 Zeichen (konfigurierbar, kein Zwang zu Sonderzeichen)
- Rate-Limit: 5 Login-Versuche pro 15 min pro IP + pro E-Mail
- CAPTCHA (Cloudflare Turnstile) bei Register + bei Login nach 3 Fehlversuchen
- Password-Reset via signed E-Mail-Token (15 min gültig)
- CSRF: tRPC Origin-Header-Check
- XSS: React-default, Custom-HTML-Blocks sind iframe-sandboxed
