# Agent Discoveries

- Prefer having the UI compose several narrow Convex queries by panel/domain instead of relying on the backend to assemble a single page-sized response object.
- For new gameplay screens, start from the visible UI sections and map each section to the narrowest source-backed query surface that can support it; only request backend stitching where the concept is inherently cross-domain.
- Query-hook count is not the primary optimization target for this app. Favor smaller, source-aligned subscriptions with tighter invalidation boundaries even if a screen uses more hooks overall.
- Research UX direction: the colony research screen should behave like a shell-level immersive surface that can open from any colony tab without navigation, similar to the global sidebar/Star Map entrypoint; avoid reintroducing it as a normal context tab.
- Live research screen note: `apps/web/src/features/research/research-immersive-view.tsx` is the real colony-scoped research surface; it now drives start/cancel actions through `api.research.enqueue`/`api.research.cancel`, so any future research UX changes should preserve that shell-level immersive flow instead of rebuilding a separate tab-local form.
