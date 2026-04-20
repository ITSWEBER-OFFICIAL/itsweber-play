# NPM Proxy Host — ITSWEBER Play (All-in-One)

Anleitung zum Einrichten in Nginx Proxy Manager (`https://192.168.0.2:81`).

> **Ein Host genügt.** Der Container-Nginx multiplext intern alles hinter Port 3000.
> Kein separater API- oder MinIO-Host nötig.

## Dev (`play-next.itsweber.net`)

**Details:**

- Domain Names: `play-next.itsweber.net`
- Scheme: `http`
- Forward Hostname/IP: `10.10.8.51`
- Forward Port: `3000`
- Cache Assets: ✅
- Block Common Exploits: ✅
- Websockets Support: ✅

**SSL:**

- Request new SSL Certificate (Let's Encrypt)
- Force SSL: ✅
- HTTP/2 Support: ✅
- HSTS: ✅

**Advanced (Custom Nginx Config):**

```nginx
client_max_body_size 8g;
proxy_request_buffering off;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
proxy_buffering off;
proxy_http_version 1.1;

proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP $remote_addr;

chunked_transfer_encoding on;
```

---

## Prod (`play.itsweber.net`) — nach DNS-Cutover

Identische Config, nur andere Domain und nach dem Cutover anlegen:

- Domain Names: `play.itsweber.net`
- Forward Hostname/IP: `10.10.8.51`
- Forward Port: `3000`
- Alles andere: identisch zu Dev oben

---

## Routing-Übersicht (zur Info — alles Container-intern)

| Externer Pfad | Intern | Dienst |
|---|---|---|
| `/` | `127.0.0.1:3001` | Next.js Web |
| `/api/trpc/*` | `127.0.0.1:4000/trpc/*` | Fastify tRPC (Prefix-Strip) |
| `/api/*` | `127.0.0.1:4000/api/*` | Fastify API + Better-Auth |
| `/s3/*` | `127.0.0.1:9000/*` | MinIO S3 (Prefix-Strip) |
| `/health` | 200 OK | Nginx Healthcheck |

---

## Vorbereitung DNS-Cutover

1. DNS TTL für `play.itsweber.net` mindestens 24h vorher auf **60s** senken
2. Bestehenden Proxy Host für MediaCMS (`192.168.0.10:8200`) deaktivieren (nicht löschen — Rollback)
3. Neuen Host anlegen, Let's-Encrypt-Cert ziehen lassen
4. Smoke-Test auf `play-next.itsweber.net` bestätigt → DNS umbiegen

## Rollback

Proxy Host `play.itsweber.net` auf MediaCMS zurückstellen (`192.168.0.10:8200`) — sofort aktiv.

## Hinweise

- NPM (192.168.0.2) erreicht `br1`-Container per L3-Routing über den Router — funktioniert.
- Container-IP vom Unraid-Host selbst nicht pingbar (Macvlan-Verhalten, normal).
- SSE (`/api/theme/events`) setzt `X-Accel-Buffering: no` selbst — NPM respektiert das.
