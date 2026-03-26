# Agent Discoveries

- Prefer having the UI compose several narrow Convex queries by panel/domain instead of relying on the backend to assemble a single page-sized response object.
- For new gameplay screens, start from the visible UI sections and map each section to the narrowest source-backed query surface that can support it; only request backend stitching where the concept is inherently cross-domain.
- Query-hook count is not the primary optimization target for this app. Favor smaller, source-aligned subscriptions with tighter invalidation boundaries even if a screen uses more hooks overall.
