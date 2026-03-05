# Agent Discoveries

- Keep `convex/schema.ts` documented with concise comments for table purpose and non-obvious fields whenever schema is added or changed.
- `convex/worldGeneration.ts` requires `UNIVERSE_GEN_TOKEN` and uses `universes.generationState` counters as the primary capacity source; if you hand-edit world rows, expect counter drift unless generation state is reconciled.
- Any file under `convex/` that exports Convex functions becomes a generated API namespace (including nested folders); place shared non-public runtime code outside `convex/` to avoid unintended `api.<module>` exposure.
