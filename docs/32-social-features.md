# Social-Features

Stand nach Session K. Die Features unten sind Teil des v0.4-Launches.

## @Mentions

- Autocomplete in Comment-Form, Reply-Form und Community-Post-Editor.
- tRPC-Procedure `user.search` mit `handle+displayName`-ILIKE-Suche, banned-User ausgeschlossen.
- Resolve: `@handle` im Body → `[apps/web/src/app/u/[handle]/page.tsx](../apps/web/src/app/u/[handle]/page.tsx)`.

## #Hashtags

- `#tag` wird per `RichText`-Component klickbar gerendert (auch in Video-Descriptions und Community-Posts).
- Route `/tag/[tag]` listet Public-LIVE-Videos mit diesem Tag (`trpc.search.byTag`).

## Pin-Comment + Creator-Heart

- `comment.pin` (Creator/Admin) setzt `pinnedAt`; max. 1 Pin pro Video (Transaction clear+set).
- `comment.heart` (Creator/Admin) toggelt `heartedByCreator`.
- Liste sortiert `pinnedAt desc, createdAt desc` — gepinnter Kommentar erscheint ganz oben.
- Badge „Gepinnt" + Button-Sichtbarkeit nur für Video-Owner/Admin.

## Multi-Reactions

- Enum `ReactionKind: LIKE | FIRE | LOL | WOW | SAD` (additive, Default `LIKE`).
- Ein User hält pro Video genau eine Reaction; Wechsel per Long-Press oder Rechtsklick.
- Counts: `reaction.counts` gibt `Record<Kind, Number>` für UI-Verteilung.

## Community-Posts

- Channel-Tab „Community" zwischen „Videos" und „Playlists" auf `/c/[slug]`.
- Feed-Block `COMMUNITY_ROW` für Startseite (Admin `/admin/page-blocks`).
- tRPC-Router `community.{list,recent,create,delete,vote}` in [apps/api/src/trpc/routers/community.ts](../apps/api/src/trpc/routers/community.ts).
- Posts unterstützen Polls (2–4 Optionen). Eine Stimme pro User, Wechsel/Entzug möglich.
- Image-Upload über `imageKey` MinIO-Feld — Admin/Creator lädt via Kanal-Assets-Endpoint.

## Nicht in v1

- Collabs/Duets/Remix → Backlog
- Repost-to-Subs → Backlog
- Live-Chat/Premieres (voller Stack) → [docs/25-v1-followup-live.md](25-v1-followup-live.md)
