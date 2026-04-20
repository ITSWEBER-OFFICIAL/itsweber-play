# 27 — Security-Baseline

Baseline-Security-Maßnahmen. Siehe auch [26-deploy-hardening.md](26-deploy-hardening.md).

## 1. Trust-Proxy

Fastify läuft hinter einem Reverse-Proxy (z. B. Nginx Proxy Manager). Ohne `trustProxy: true` sieht Fastify die Proxy-Container-IP als Client — Rate-Limit wäre wirkungslos (eine IP für alle Welt). Mit trustProxy wertet Fastify `X-Forwarded-For` aus; der Proxy muss den Header setzen (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`).

## 2. Helmet / CSP

`@fastify/helmet` setzt die üblichen Security-Header:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (siehe `frameAncestors: 'none'`)
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Resource-Policy: cross-origin` (damit der Web-Container Thumbnails laden kann)

HSTS kommt von NPM (Force-SSL + HSTS-Checkboxen) — doppelte Header vermeiden.

Content-Security-Policy (API-seitig, für Dev-Tools + Admin-Direktzugriffe):

```
default-src 'self';
img-src 'self' data: ${NEXT_PUBLIC_S3_PUBLIC_URL};
media-src 'self' ${NEXT_PUBLIC_S3_PUBLIC_URL};
connect-src 'self' ${NEXT_PUBLIC_S3_PUBLIC_URL} ${PUBLIC_URL};
script-src 'self';
style-src 'self' 'unsafe-inline';
object-src 'none';
frame-ancestors 'none';
```

Web-Frontend hat eigene CSP in `apps/web` — dort liegen die inline-Styles für Design-Tokens, die für die API irrelevant sind.

## 3. Rate-Limit (Redis-backed)

`@fastify/rate-limit` nutzt Redis als Shared-Store (persistiert über Restart, skaliert horizontal). Global-Default ist off — Enforcement pro Route:

| Route | Max / Fenster | Grund |
|---|---|---|
| `/api/auth/*` | 20 / 60 s | Brute-Force-Schutz (Login, Register, Password-Reset) |
| `/api/upload` | 10 / 60 s | Spam-Uploader blocken, legitime Creator nicht treffen |
| Global | `RATE_LIMIT_MAX` (120) / 60 s | Fallback für sonstige Endpoints (opt-in) |

**Follow-up:** Granulare Rate-Limits für `/trpc/search.*`, `/trpc/report.*`, `/trpc/comment.create` via tRPC-Middleware — Fastify-Route-Level erreicht nur den gesamten `/trpc`-Prefix.

## 4. Magic-Bytes-Validierung

Header-basierte Validierung ist unzureichend — `curl -H "Content-Type: image/png"` lügt ohne Widerstand. `apps/api/src/magic-bytes.ts` prüft jetzt die ersten ~4 KB jedes Uploads via `file-type`:

- `readAndValidateMime()` — puffert den gesamten Body (für Assets ≤ 4 MB: Logo, Avatar, Banner, Thumbnail)
- `peekAndValidateMime()` — peekt die ersten Bytes aus dem Stream und liefert einen Replay-Stream, in dem das Gepeekte zurückgespielt wird (für große Video-Uploads)

Der Extension im MinIO-Key wird aus dem **detektierten** MIME abgeleitet, nicht aus dem Header. Ein angeblicher `.png`-Upload mit JavaScript-Body scheitert hart:

- kein valider Magic-Bytes-Match → 415 `UNSUPPORTED_MEDIA_TYPE`
- MIME erkannt, aber nicht in der Allow-List → 415 mit echtem MIME als Hint

Captions (VTT/SRT) bleiben bei der bisherigen Inhalts-Prüfung (`WEBVTT`-Header) + SRT→VTT-Konverter — `file-type` detektiert keine Plain-Text-Formate.

## 5. Upload-Limits (Defense-in-Depth)

| Endpoint | Max Size |
|---|---|
| `/api/upload` (Video) | `MAX_UPLOAD_SIZE_MB` (Default 8192 MB) |
| `/api/admin/theme/logo` | 2 MB |
| `/api/studio/avatar` | 2 MB |
| `/api/studio/banner` | 4 MB |
| `/api/studio/video/:id/thumbnail` | 2 MB |
| `/api/studio/video/:id/caption` | 1 MB |

NPM setzt `client_max_body_size 8g` auf Prod-Web + Prod-API Hosts (spiegelt `MAX_UPLOAD_SIZE_MB`). Ohne das bricht NPM mit 413 ab, bevor Fastify den Request sieht.

## 6. Secrets-Management

Alle kritischen Env-Vars sind in `.env` (nicht im Git). Compose prüft per `${VAR:?err}` früh auf Anwesenheit, bricht sonst ab.

Generierung vor dem ersten Deploy:

```bash
AUTH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)
```

`S3_SECRET_KEY` = `MINIO_ROOT_PASSWORD` (MinIO-Shortcut — später, bei Multi-User-Access, eigenes Service-Account-Token über MinIO-Console anlegen).

## 7. Session-Invalidation

Better-Auth invalidiert bei Password-Reset alle Sessions des Nutzers (`session.revokeAll` wird im Reset-Hook aufgerufen). Manuelle Verifikation: `/reset-password?token=…` absenden → alle offenen Browser-Tabs auf `/login` umgeleitet.

CSRF: Better-Auth setzt `SameSite=Lax` auf die Session-Cookies. Für tRPC-POST-Mutations reicht das, weil `fetch` mit `credentials: "include"` von fremden Origins blockt wird. Ein zusätzlicher Double-Submit-Token bleibt auf dem Backlog, falls Embedding in iFrames jemals auf den Tisch kommt.

## 8. Follow-Ups (bewusst ausgelagert)

- **AI-Moderation** (Ollama-Integration für Comment-Toxicity) — Opt-in via `OLLAMA_URL`
- **CSRF-Doppelpass-Token** — nur nötig bei iframe-Embed
- **Correlation-IDs + Sentry** — Observability-Session (post-v0.4)
- **WAF-Regeln auf NPM** — Cloudflare-Ebene, wenn CDN scharfgeschaltet wird
