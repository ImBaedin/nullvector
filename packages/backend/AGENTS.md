# Agent Discoveries

- Keep `convex/schema.ts` documented with concise comments for table purpose and non-obvious fields whenever schema is added or changed.
- `convex/worldGeneration.ts` requires `UNIVERSE_GEN_TOKEN` and uses `universes.generationState` counters as the primary capacity source; if you hand-edit world rows, expect counter drift unless generation state is reconciled.
- Any file under `convex/` that exports Convex functions becomes a generated API namespace (including nested folders); place shared non-public runtime code outside `convex/` to avoid unintended `api.<module>` exposure.
- `bunx convex codegen` / deploy typecheck includes TypeScript tests under `convex/**`; if helper signatures in runtime become stricter, update those test fixtures too or Convex deploy can fail even when app-level `check-types` still passes.
- When authoring or changing Convex functions in this package, use the `convex` and `convex-functions` skills first; default to current Convex docs/patterns rather than memory.
- Prefer narrow, source-aligned Convex queries over page-shaped monolithic queries. If a UI panel mainly reflects one row or one indexed row set, expose that row/set directly instead of stitching a broad overview DTO.
- Optimize Convex reads for bandwidth and invalidation scope, not for minimizing query-hook count. It is acceptable to split one broad query into several smaller queries if that reduces internal reads and reactive churn.
- Avoid projection tables/read models by default in this codebase. Prefer querying source-of-truth tables directly unless a derived view is clearly necessary and its sync/migration cost is justified.
- Treat broad stitched queries as an exception. Before adding one, check whether the data can instead be split by domain volatility such as economy, infrastructure, policy, ships, queue, fleet, or threat state.
- Avoid fanout follow-up lookups on hot paths where practical. If a query loads a row set and then performs per-row companion fetches, consider folding that data into the primary row shape or exposing a narrower query boundary.
- Convex query checklist before adding/changing a function:
  1. Can this UI consume one row or one indexed row set directly?
  2. Can this broad query be split by domain or volatility boundary?
  3. Will a change in one small subsystem unnecessarily invalidate a large response?
  4. Is this query doing per-row follow-up lookups on a hot path?
  5. Does the function really need a stitched response, or is it just more convenient for the caller?
