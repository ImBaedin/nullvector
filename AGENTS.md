# Agent Discoveries

- Convex index names must be 64 characters or fewer. Long descriptive names can fail deployment; prefer compact but still readable index names.
- Colony overflow behavior for this project: transport overflow is retained in a per-resource `overflow` bucket on the colony, and local production for a resource is paused while that resource's overflow is greater than zero.
- In this monorepo, check for and follow package-specific `AGENTS.md` files when working inside that package (for example, `packages/backend/AGENTS.md`).
