# Direct Messages (1:1)

1:1-Nachrichten zwischen eingeloggten Usern. MVP-Scope: Text only, keine
Gruppen, keine Voice/Video, keine Reactions.

## Datenmodell

- `DirectMessage { id, senderId, recipientId, body, readAt?, createdAt }`
- Indizes: `(senderId, recipientId, createdAt)` + `(recipientId, createdAt)` für Inbox-Queries.
- `User.dmPermission: ALL | SUBSCRIBERS_ONLY | NONE` entscheidet, wer den User anschreiben darf. Default `ALL`.

## tRPC

| Procedure | Scope | Zweck |
|---|---|---|
| `dm.listThreads` | protected | Inbox-Sidebar: je Gegenüber 1 Eintrag + unread-Count |
| `dm.listMessages` | protected | Chronologischer Thread-View |
| `dm.sendMessage` | protected | Gated via `canSendTo()` (s. unten) |
| `dm.markRead` | protected | Markiert alle ungelesenen Incoming-Messages eines Peers als gelesen |
| `dm.unreadCount` | protected | Badge im Header (`<InboxBell/>`) |

`canSendTo()` lehnt ab wenn:
- Sender = Recipient (Self-DM),
- Recipient banned,
- Recipient `dmPermission=NONE` (Admin umgeht diese Regel),
- `SUBSCRIBERS_ONLY` und Sender hat keinen Kanal des Recipients abonniert.

## UI

- `/inbox` — Split-Layout (Thread-Liste links, Chat-View rechts).
- `?to=<userId>` öffnet direkt einen neuen Thread mit der Person.
- Header zeigt Envelope-Icon (`<InboxBell/>`) mit Badge für `unreadCount` (30-s-Polling).
- Auto-markRead beim Öffnen eines Threads.

## Moderation & Abuse

- DM-Texte laufen NICHT durch die Comment-AI-Moderation (Privat-Kommunikation).
- Missbrauch-Meldung über `/admin` manuell — künftig via neuem `reportDM`.
- Rate-Limiting: `@fastify/rate-limit` auf `/api/trpc/dm.sendMessage` — Redis-backed.

## Zukunft (v1.1+)

- Gruppen-DMs (2-N).
- File/Image-Attachments (MinIO `play-dms`-Bucket).
- End-to-End-Verschlüsselung (Signal-Protokoll via `libsignal-client`).
- Push-Notifications nach PWA-Standard.
