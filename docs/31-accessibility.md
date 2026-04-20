# Barrierefreiheit (WCAG 2.2 AA)

Die Plattform ist auf WCAG 2.2 AA ausgerichtet. Die hier beschriebenen
Pattern sind auf der gesamten Plattform eingesetzt.

## Kern-Patterns

| Ebene | Pattern | Datei |
|---|---|---|
| HTML | Skip-Link `#main` als erster Body-Node | [apps/web/src/app/layout.tsx](../apps/web/src/app/layout.tsx) |
| HTML | `<main id="main">` auf jeder Landing-Seite | Home, Watch, Search, Channel, Tag, Inbox, /u, /help |
| Bilder | `next/image` mit Alt-Texten statt `<img>` | [video-card.tsx](../apps/web/src/components/video-card.tsx), [channel-client.tsx](../apps/web/src/app/c/[slug]/channel-client.tsx), [hero-block.tsx](../apps/web/src/components/blocks/hero-block.tsx) |
| Bilder | `images.remotePatterns` inkl. MinIO dynamisch | [next.config.mjs](../apps/web/next.config.mjs) |
| Motion | `motion-reduce:*`-Varianten auf Animationen | Shorts, Reaction-Picker, Onboarding |
| Live | `aria-live="polite"` auf dynamischen Listen | Comments, DM-Thread, Toast |
| Kontrolle | `aria-pressed`/`aria-selected` mit boolschem Wert | Comment-Pin/Heart, Reaction-Picker, Mention-Autocomplete |
| Focus | `focus-visible:border-brand` statt `focus:` | Form-Inputs, Buttons |

## Reaktion-Picker

- Long-Press (400 ms) oder Rechtsklick auf den Heart-Button öffnet eine Emoji-Reihe (LIKE/FIRE/LOL/WOW/SAD).
- Menü hat `role="menu"` und `aria-label`, jeder Button `role="menuitem"` + `sr-only`-Label.
- Counts pro Kind werden unterhalb des Buttons angezeigt.

## @Mention + #Hashtag

- `MentionTextarea` öffnet nach `@`-Tippen ein Dropdown (`role="listbox"`), Pfeiltasten + Enter/Tab vervollständigen, Escape schließt.
- `RichText` rendert `@handle` → Link `/u/{handle}`, `#tag` → Link `/tag/{tag}`, URLs → Target-Blank-Anker.

## Screen-Reader-Notes

- Skip-Link ist `sr-only` bis Tastaturfokus, dann sichtbar oben links.
- Badges haben `title` für Tooltip (Pin, Creator-Heart).
- `notification-bell` + `inbox-bell` tragen `aria-label` mit Ungelesen-Count.

## Tests

- Manuelle Keyboard-Walk-Through-Tests auf Home, Watch, Studio-Upload, /inbox.
- `prefers-reduced-motion`-Browsertest deaktiviert Scale/Translate auf Shorts, Reaction-Picker, Onboarding.
- axe-core-Smoke auf 5 Key-Pages — 0 kritische Violations (Stand v0.4).
