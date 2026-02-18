# Agent Discoveries

- Keep `convex/schema.ts` documented with concise comments for table purpose and non-obvious fields whenever schema is added or changed.
- `convex/worldGeneration.ts` requires `UNIVERSE_GEN_TOKEN` and uses `universes.generationState` counters as the primary capacity source; if you hand-edit world rows, expect counter drift unless generation state is reconciled.
