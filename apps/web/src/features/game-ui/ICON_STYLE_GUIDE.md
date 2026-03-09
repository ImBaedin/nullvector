# Game UI Icon Style Guide (Neon Dockyard)

## Intent

Navigation icons should read instantly at small sizes and feel bespoke to the Neon Dockyard shell without requiring manual resizing.

## Visual System

- Style: low-detail sci-fi glyphs (not painterly, not photoreal).
- Silhouette first: clear shape recognition in under 1 second.
- Contrast: cyan/white emphasis on transparent background.
- Detail budget: minimal internal detail; prioritize bold forms.

## Canvas + Export

- Master size: 1024x1024 PNG.
- Background: transparent.
- Subject scale: icon should fill ~80-88% of canvas height/width.
- No border/frame around the icon.
- No text or watermark.

## In-UI Usage

- Render size: 20x20 (`h-5 w-5`).
- Fit mode: `object-contain`.
- Directory: `/game-icons/nav/*.png`.

## Current Set

- `/game-icons/nav/overview.png`
- `/game-icons/nav/resources.png`
- `/game-icons/nav/facilities.png`
- `/game-icons/nav/shipyard.png`
- `/game-icons/nav/defenses.png`
- `/game-icons/nav/fleet.png`
- `/game-icons/nav/starmap.png`

## Prompt Pattern For New Icons

Use this structure when generating new icons:

```text
Use case: logo-brand
Asset type: game UI navigation icon
Primary request: <TAB NAME> tab icon for a sci-fi colony management game
Style/medium: bespoke flat sci-fi glyph icon, low-detail, strong silhouette
Composition/framing: single icon centered and filling most of canvas, transparent background
Lighting/mood: subtle cyan glow accents
Color palette: cyan-white on transparent
Constraints: no text, no watermark, no border frame, icon should fill canvas for direct use without manual resizing
```
