# Remotion Pipeline

`apps/remotion/` is a standalone pnpm workspace package that renders demo videos using [Remotion 4.x](https://remotion.dev).

## Package structure

```
apps/remotion/
  src/
    Root.tsx               # registerRoot + 4 Composition definitions
    brand.ts               # shared color tokens (Navy, Atom Green)
    compositions/
      WelcomeLong.tsx      # 90s platform intro (1920×1080 @30fps)
      StudioTourLong.tsx   # 60s studio tour   (1920×1080 @30fps)
      ShortsFeatureShort.tsx # 15s vertical teaser (1080×1920 @60fps)
      AccessibilityShort.tsx # 20s a11y features  (1080×1920 @60fps)
  scripts/
    render.mjs             # CLI render script (uses @remotion/bundler + @remotion/renderer)
```

## Compositions

| ID | Duration | Resolution | FPS | Description |
|---|---|---|---|---|
| `WelcomeLong` | 90s (2700f) | 1920×1080 | 30 | Platform intro with animated logo + feature slides |
| `StudioTourLong` | 60s (1800f) | 1920×1080 | 30 | Studio sections: Upload, Editor, Analytics, Branding, Admin |
| `ShortsFeatureShort` | 15s (900f) | 1080×1920 | 60 | Vertical teaser — Shorts format showcase |
| `AccessibilityShort` | 20s (1200f) | 1080×1920 | 60 | 4 a11y feature cards (Captions, Keyboard, Contrast, Transcript) |

## Rendering

```bash
cd apps/remotion

# Render all 4
pnpm render

# Render one
pnpm render -- --composition WelcomeLong

# Output: out/WelcomeLong.mp4, out/StudioTourLong.mp4, …
```

## Previewing (Remotion Studio)

```bash
pnpm studio   # Opens http://localhost:3001
```

## React 18 note

The main web app uses React 19. Remotion 4.x targets React 18.3.x. The `apps/remotion` package pins `react@18.3.1` in its own `package.json`; pnpm workspaces keeps them isolated.

## Brand tokens

`src/brand.ts` exports the `BRAND` const that matches the design tokens in `packages/theme/tokens.json`:

```ts
export const BRAND = {
  navy: "#0A1A26",
  green: "#3FE48B",
  white: "#F5F9FC",
  dim: "#8CA0B3",
};
```
