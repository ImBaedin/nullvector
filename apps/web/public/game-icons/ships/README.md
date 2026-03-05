# Ship Icon Art Style Guide

This folder contains generated ship art for the web UI.

## Visual style
- Top-down sci-fi ship icon
- Icon-adjacent (readable at small sizes)
- Semi-flat digital painting with crisp edges
- Centered single ship on transparent background
- No text, no logos, no watermark

## Consistency rules
- Camera: top-down gameplay-readable angle
- Composition: centered hull with strong silhouette and generous margin
- Palette: gunmetal, steel, cyan engine glow, restrained amber accents
- Materials: armored plating, clean panel seams, subtle emissive ports
- Lighting: cool rim highlights, soft metallic reflections, controlled contrast

## Base prompt template
Use this template and only swap `<SHIP SUBJECT>`:

```txt
Top-down sci-fi ship icon of <SHIP SUBJECT> for a strategy game UI.
Use case: ui-mockup.
Asset type: game UI ship art.
Style/medium: high-detail digital painting, icon-adjacent, readable at small sizes.
Composition/framing: single centered ship, full body visible, clear silhouette, generous margin.
Lighting/mood: soft studio rim light with metallic reflections.
Color palette: gunmetal and steel with cyan glow accents, restrained warm highlights.
Materials/textures: armored plating, panel seams, subtle emissive ports.
Constraints: transparent background, no text, no logos, no watermark, single ship object.
Avoid: cluttered background, blur, excessive FX, noisy details.
```

## Generation settings
- Model: `gpt-image-1.5`
- Size: `1024x1024`
- Quality: `high`
- Background: `transparent`
- Output format: `png`

## Command pattern
From repo root:

```bash
python3 /Users/baedin/.codex/skills/imagegen/scripts/image_gen.py generate \
  --prompt "<FULL PROMPT>" \
  --model gpt-image-1.5 \
  --size 1024x1024 \
  --quality high \
  --background transparent \
  --output-format png \
  --out "/Users/baedin/Documents/projects/nullvector/apps/web/public/game-icons/ships/<file>.png"
```

## Current assets
- `small-cargo.png`
- `large-cargo.png`
- `colony-ship.png`
