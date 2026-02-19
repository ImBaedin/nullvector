# @nullvector/galaxy-generator

Offline deterministic generator for stylized low-poly galaxy assets with volumetric spiral-arm topology.

## What it produces

- `models/*.glb`: one GLB per generated galaxy
- `manifest.json`: typed metadata for loading and selection (schema `2.0.0`)

## Usage

From repo root:

```bash
bun run -F @nullvector/galaxy-generator generate
```

With options:

```bash
bun run -F @nullvector/galaxy-generator generate \
  --out apps/web/public/generated/galaxies \
  --count 16 \
  --seed nullvector-galaxy-library-v1 \
  --overwrite true \
  --profile spiral-volumetric-v2
```

## CLI options

- `--out <path>` output directory (default: `generated/default` inside package cwd)
- `--count <n>` number of models to generate (default: `16`)
- `--seed <string>` deterministic library seed
- `--overwrite <true|false>` clear output dir first
- `--profile <id>` generation profile (default: `spiral-volumetric-v2`)

## Programmatic API

```ts
import { generateGalaxyLibrary, generateGalaxyModel } from "@nullvector/galaxy-generator";
```

## Notes

- Generation is deterministic by seed and profile.
- Models use indexed primitives and explicit volume extrusion for core and arms.
- QA stats include watertightness, open edge count, degenerate triangle count, and thickness ratio.
- `spiral-lowpoly-v1` is still available for compatibility.
