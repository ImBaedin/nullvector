# Facility Icon Art Style Guide

This folder contains generated facility art for the web UI.

## Visual style
- Isometric sci-fi facility portrait
- Icon-adjacent (simplified, readable at small sizes)
- Semi-flat digital painting with crisp edges
- Centered single subject on transparent background
- No text, no logos, no watermark

## Consistency rules
- Camera: slight top-down 3/4 isometric view
- Composition: centered object with clear silhouette
- Palette: steel blue, cyan, slate, restrained warm highlights
- Materials: brushed metal, reinforced panels, subtle holographic strips
- Lighting: cool rim light, soft ambient shadows, subtle glow accents

## Base prompt template
Use this template and only swap `<FACILITY SUBJECT>`:

```txt
Isometric sci-fi facility portrait of <FACILITY SUBJECT>.
Use case: stylized-concept.
Asset type: game UI facility art.
Style/medium: clean isometric digital painting, icon-adjacent, semi-flat with crisp edges.
Composition/framing: centered subject, readable silhouette at small sizes, slight top-down 3/4 angle.
Lighting/mood: cool rim lighting, soft ambient shadows, subtle glow accents.
Color palette: steel blue, cyan, slate, restrained warm highlights.
Materials/textures: brushed metal, reinforced panels, holographic strips.
Constraints: transparent background, no text, no logos, no watermark, single facility object.
Avoid: photorealism, cluttered background, noisy details.
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
  --out "/Users/baedin/Documents/projects/nullvector/apps/web/public/game-icons/facilities/<file>.png"
```

## Current assets
- `shipyard.png`
- `robotics-hub.png`
- `logistics-nexus.png`
- `defense-matrix.png`
- `sensor-array.png`
- `command-nexus.png`
