# Agent Discoveries

- Convex index names must be 64 characters or fewer. Long descriptive names can fail deployment; prefer compact but still readable index names.
- Colony overflow behavior for this project: transport overflow is retained in a per-resource `overflow` bucket on the colony, and local production for a resource is paused while that resource's overflow is greater than zero.
- In this monorepo, check for and follow package-specific `AGENTS.md` files when working inside that package (for example, `packages/backend/AGENTS.md`).
- MVP upgrade timing rule: upgrades are resolved only during explicit colony sync calls; accrual must be segmented so post-completion offline time uses upgraded production rates.
- For Better Auth + Convex web auth, do not manually call `/api/auth/convex/token` from app code; rely on `ConvexBetterAuthProvider` + `convexClient()` plugin and gate Convex queries/mutations with `useConvexAuth()`.
- Queueing model has moved to lane-based `colonyQueueItems`; building upgrades snapshot `fromLevel/toLevel`, cost, and timing at enqueue (cost deducted immediately), and colony/UI queue timing should be driven by `queues.nextEventAt` instead of legacy `activeUpgrade`.
- Shared gameplay DTO/key types now live in `packages/game-logic/src/gameplay.ts` (exported via `@nullvector/game-logic`); prefer importing `BuildingKey`/resource-card queue types from there instead of redefining them in web/backend modules.
