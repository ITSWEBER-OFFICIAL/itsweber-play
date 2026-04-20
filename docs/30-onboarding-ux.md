# Onboarding UX — Tour, Tooltips & /help

## Onboarding Tour

`apps/web/src/components/onboarding-tour.tsx` — a 4-step overlay shown once to new authenticated users.

### Steps

| # | Title | Description |
|---|---|---|
| 1 | Willkommen bei ITSWEBER Play | Platform intro |
| 2 | Videos hochladen & importieren | Upload + yt-dlp import |
| 3 | Studio | Trim, captions, thumbnail picker |
| 4 | Kanal & Community | Channel page, subscriptions, notifications |

### Behavior

- Only shown to signed-in users (`useSession()` guard).
- Delayed 1200ms after first render so the page has time to settle.
- Dismissed permanently via `localStorage.setItem("onboarding-done", "1")`.
- Skip button and X button both dismiss immediately.
- Progress bar shows current step position.

### Resetting (dev/test)

```js
localStorage.removeItem("onboarding-done");
```

## InfoTooltip Component

`apps/web/src/components/info-tooltip.tsx` — accessible hover/focus tooltip with optional `/help` deep-link.

### Usage

```tsx
import { InfoTooltip } from "@/components/info-tooltip";

<label>
  Sichtbarkeit
  <InfoTooltip
    text="Steuert wer das Video sehen kann."
    helpHref="/help#visibility"
  />
</label>
```

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `text` | `string` | yes | Tooltip text |
| `helpHref` | `string` | no | Links to `/help#anchor` inside the tooltip |

### Accessibility

- Trigger button has `aria-describedby` pointing at the tooltip `role="tooltip"`.
- Show on hover and focus; hide on mouse-leave with 150ms delay (allows cursor to move into tooltip).
- Tooltip stays visible while focused inside.

### Current usages (~20 placements)

- Upload page: Format toggle, Source toggle
- Edit page: Tags, Format, Visibility, Comments fields
- Admin settings: Registrierung section, Standard-Sichtbarkeit field

## /help Page

`apps/web/src/app/help/page.tsx` — Server Component, no JS required.

### Structure

4 sections with anchor IDs:

| Section | Anchor | Terms |
|---|---|---|
| Videos & Formate | `#format`, `#short`, `#transcode`, `#hls`, `#import` | 5 |
| Kanäle & Creator | `#channel`, `#visibility`, `#tags`, `#studio` | 4 |
| Community | `#subscription`, `#notification`, `#comments` | 3 |
| Admin & Plattform | `#registration`, `#theme` | 3 |

Linked from the site footer (`Hilfe` link) and from InfoTooltip `helpHref` attributes.
