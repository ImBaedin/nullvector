# Meta-Matter Sprite Art Style Guide

This folder contains generated meta-matter resource sprites for the web UI.

## Visual style

- 256x256 transparent PNG resource sprite
- Semi-flat sci-fi digital painting with crisp edges
- Readable at small UI sizes
- Centered abstract exotic-matter token with a clear silhouette
- No text, no logos, no watermark

## Consistency rules

- Composition: single centered object, full object visible, generous transparent margin
- Form language: abstract glyphs, void centers, orbital planes, broken rings, and smooth energy fins
- Materials: glassy energy-matter, smooth refractive planes, faint contour lines
- Lighting: subtle inner glow, thin rim light, soft ambient shadow, restrained contrast
- Common palette: dominant `#a0b4cc`, pale desaturated blue-gray planes, graphite negative-space cuts
- Rare palette: dominant `#6ecbff`, pale cyan planes, graphite negative-space cuts
- Mythic palette: dominant `#e48cff`, pale magenta planes, graphite negative-space cuts

## Base prompt template

Use this template and swap `<RARITY>`, `<FORM>`, and `<PALETTE>`:

```txt
A 256x256 abstract game UI sprite of <RARITY> meta-matter: <FORM>.
Use case: stylized-concept.
Asset type: game UI resource sprite.
Style/medium: clean semi-flat sci-fi icon painting, crisp edges, readable at 32px, restrained detail.
Composition/framing: single centered abstract object, full object visible, clear silhouette, generous transparent margin, not a natural crystal cluster.
Lighting/mood: subtle inner glow, thin rim light, soft ambient contact shadow, controlled contrast.
Color palette: <PALETTE>.
Materials/textures: glassy energy-matter, smooth refractive planes, faint contour lines, no rough mineral facets.
Constraints: transparent background, no text, no logos, no watermark, one resource object only, square icon composition.
Avoid: crystal cluster, gemstone, ore pile, rock, clutter, background scene, particle storm, excessive bloom, photorealism, noisy micro-detail.
```

## Generation settings

- Model: `gpt-image-1.5`
- Generation size: `1024x1024`
- Final size: `256x256`
- Quality: `medium`
- Background: `transparent`
- Output format: `png`

## Current prompt variants

- Common form: `a suspended irregular nucleus made from three smooth translucent planes orbiting a small dark void, like condensed anomalous matter rather than a mineral crystal`
- Common palette: `common rarity uses #a0b4cc as the dominant glow color, with pale desaturated blue-gray planes and graphite negative-space cuts`
- Rare form: `a suspended broken torus of translucent energy-matter segments wrapping around a small dark void, like a compact impossible-material token rather than a mineral crystal`
- Rare palette: `rare rarity uses #6ecbff as the dominant glow color, with pale cyan planes and graphite negative-space cuts`
- Mythic form: `a suspended impossible diamond-ring glyph with a central dark void and four thin shard-like energy fins, like compressed exotic matter rather than a mineral crystal`
- Mythic palette: `mythic rarity uses #e48cff as the dominant glow color, with pale magenta planes and graphite negative-space cuts`

## Command pattern

From repo root, create a temporary JSONL file under `tmp/imagegen/` with one prompt per line, then run:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/imagegen/scripts/image_gen.py" generate-batch \
  --input tmp/imagegen/<batch-file>.jsonl \
  --out-dir apps/web/public/game-icons/meta-matter \
  --model gpt-image-1.5 \
  --size 1024x1024 \
  --quality medium \
  --background transparent \
  --output-format png \
  --downscale-max-dim 256 \
  --downscale-suffix '' \
  --force \
  --concurrency 3
```

## Current assets

- `meta-matter-common.png`
- `meta-matter-rare.png`
- `meta-matter-mythic.png`
