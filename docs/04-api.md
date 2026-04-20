# 04 — API

Fastify + tRPC. Alle Endpoints typisiert Ende-zu-Ende zum Next.js-Client.

## Base-URLs

| Env | URL |
|---|---|
| Dev | `http://localhost:4000` |
| Prod | intern `http://play-api:4000` · extern nur `/trpc/*` über `play-web` SSR-Proxy |

## Router-Übersicht

```
appRouter
├── auth         (register, login, logout, session, passwordReset)
├── user         (me, updateProfile, listChannels, myVideos)
├── video        (list, get, create, update, delete, setVisibility, import)
├── upload       (tusSignedUrl, completeUpload)
├── comment      (list, create, delete, toggleOnVideo)
├── reaction     (like, unlike, listLikedByUser)
├── subscription (subscribe, unsubscribe, listSubscribers)
├── playlist     (create, addVideo, removeVideo, list)
├── search       (videos, channels, tags)
├── theme        (get, update, listPresets, applyPreset, exportJson, importJson)
├── admin
│   ├── user     (list, updateRole, ban, unban)
│   ├── video    (listAll, forceDelete, moderationQueue)
│   ├── theme    (updateCustomCss, revisionHistory)
│   └── block    (list, create, update, delete, reorder)
└── health       (ping, dbStatus, queueStatus)
```

## Auth-Flows

**Email/Passwort** (Better Auth):
1. `POST /auth/register` → sendet Bestätigungs-E-Mail
2. `POST /auth/verify?token=…`
3. `POST /auth/login` → Cookie gesetzt
4. `GET /auth/session` → Session-User für Client

**OIDC (später, v1)**:
1. `/auth/oidc/authorize` → Redirect zu Authentik
2. Authentik Callback → `/auth/oidc/callback` → Session

## Upload-Flow (tus.io resumable)

1. Client: `trpc.upload.tusSignedUrl` mit `{filename, size, mimeType}` → Signed URL zum `play-api`/`tus`-Endpoint
2. Client uploaded in Chunks direkt zum API
3. API streamt zu MinIO (tus-node-server + S3-backend)
4. `trpc.upload.completeUpload` → API enqueued Transcoding-Job
5. WS (Redis pub/sub): `video.processingProgress` → Client zeigt Fortschritt

## Visibility-Enforcement

Jeder Video-Read-Endpoint prüft zentral:

```ts
// packages/shared/visibility.ts
export function canViewVideo(video: Video, viewer: User | null): boolean {
  switch (video.visibility) {
    case "public":    return true;
    case "unlisted":  return true;                       // aber nicht listbar
    case "logged_in": return viewer !== null;
    case "private":   return viewer?.id === video.ownerId
                        || viewer?.role === "admin";
  }
}
```

`list`-Endpoints filtern zusätzlich `unlisted` und `private` raus — diese sind nur per direkten Get-ID-Call erreichbar.

## HLS-Streaming

- MinIO speichert HLS-Segmente
- Abruf via `GET /hls/:videoId/master.m3u8` (signed URL, 1h gültig)
- Für `private/logged_in` Videos: Signed URL nur bei bestandener `canViewVideo`-Prüfung

## Rate Limiting

- Global: 60 req/min/IP (Fastify-Plugin)
- Upload: 5 parallel pro User
- Register: 3 per IP per Stunde

## Error-Format

Einheitlich via `trpcError.formatError`:
```json
{ "code": "FORBIDDEN", "message": "...", "httpStatus": 403 }
```
