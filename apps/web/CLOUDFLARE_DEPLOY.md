# Cloudflare Pages Deploy (apps/web)

This app is a static Vite SPA (TanStack Router + Convex APIs), so deploy it on **Cloudflare Pages**.

## 1) Required env vars
Set these in Cloudflare Pages for each environment (Preview + Production):

- `VITE_CONVEX_URL` = your Convex deployment URL (for example `https://<deployment>.convex.cloud`)
- `VITE_CONVEX_SITE_URL` = your Convex site URL used by Better Auth (for example `https://<deployment>.convex.site`)

## 2) Create the Pages project
Use these settings:

- Framework preset: `Vite`
- Root directory: `apps/web`
- Build command: `bun run build`
- Build output directory: `dist`

## 3) SPA fallback routing
`public/_redirects` is included with:

```txt
/* /index.html 200
```

This ensures deep links like `/game/colony/...` resolve correctly on refresh.

## 4) Domain + auth callback checks
After first deploy:

- Add your custom domain in Cloudflare Pages (optional).
- In Convex/Better Auth allowed origins, include your Pages URL and custom domain.
- Verify sign-in and sign-out flows from both preview and production URLs.

## 5) CLI deploy option (optional)
From `apps/web`:

```bash
bunx wrangler pages deploy dist --project-name <your-pages-project-name>
```

(You can run this after `bun run build`.)
