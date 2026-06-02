# Nullvector

Nullvector is a browser-first sci-fi strategy game about building colonies, expanding through a generated galaxy, and managing the logistics that keep an empire alive. It is built as a real-time systems game: production continues over time, ship and defense queues resolve on the server, fleets travel between colonies and planets, and player progression unlocks new capabilities as the game opens up.

The project is also a product-engineering exercise. The goal is not just to render a set of screens, but to make a playable strategy loop with enough backend structure, shared simulation logic, and UI polish to support a growing game.

## Game Highlights

- Colony management with resource generators, storage buildings, facilities, shipyards, defense grids, and lane-based build queues.
- A server-owned economy loop that accrues production over elapsed time, handles storage overflow, and keeps offline progress deterministic.
- Fleet gameplay for transport, colonization, contract missions, inbound visibility, travel timing, cargo capacity, fuel cost, and mission outcomes.
- Shipyard and defense systems with typed unit definitions, build durations, cancellation behavior, and shared frontend/backend balancing data.
- Combat contracts against hostile factions, including generated mission templates, difficulty tiers, enemy fleets, defenses, reward snapshots, and combat resolution.
- NPC raids, raid scheduling, raid results, and notification plumbing for event-driven colony pressure.
- Quest and rank progression that gates features, ships, facilities, colony caps, contract difficulty, and onboarding objectives.
- A 3D universe explorer built with React Three Fiber, including galaxy/sector/system/planet levels, camera focus, adaptive quality, hover panels, breadcrumbs, and star-map destination picking.
- A dark, game-specific UI system with reusable primitives, resource strips, alert rails, colony navigation, notification center, settings, and a dev console for fast iteration.
- Deterministic world generation for universes, galaxies, sectors, systems, planets, planet economies, hostility, and colonizable capacity.

## Product And Engineering Shape

Nullvector is organized around gameplay systems rather than isolated pages. The important game rules live in shared packages so the UI and backend use the same definitions for costs, unlocks, production rates, ships, defenses, contracts, combat, progression, and quests.

The backend is Convex-based and owns authoritative state transitions. Queue completions, fleet events, and raid reconciliation are scheduled server-side instead of relying on client polling. The frontend subscribes to reactive Convex data and renders the colony, fleet, contract, and universe views from those live snapshots.

The UI is intentionally dense and operational. It favors colony telemetry, queue state, mission planning, and resource visibility over marketing-style presentation. That makes the game feel closer to a command console: information-rich, dark-first, and built for repeated decisions.

## Tech Stack

- Bun workspaces and Turborepo for the monorepo.
- React 19, Vite, TanStack Router, Tailwind CSS v4, and custom game UI primitives for the web app.
- React Three Fiber, Drei, and Three.js for the universe explorer.
- Convex for the database, functions, scheduled work, crons, and reactive client data.
- Better Auth with the Convex Better Auth integration for email/password auth across web and native.
- Expo/React Native scaffold for the native app.
- Vitest, TypeScript, oxlint, and oxfmt for tests and code quality.

## Project Structure

```text
apps/
  web/                 React + Vite game client
  native/              Expo/React Native client scaffold

packages/
  backend/             Convex schema, functions, crons, and runtime gameplay services
  game-logic/          Pure deterministic game formulas and definitions
  galaxy-generator/    Offline deterministic GLB galaxy asset generator
  env/                 Typed environment validation for web/native
  config/              Shared tooling configuration
```

Useful areas to explore:

- `apps/web/src/features/colony-route` for colony, fleet, shipyard, contracts, and mission-planning UI.
- `apps/web/src/features/universe-explorer-realdata` for the 3D star map.
- `apps/web/src/features/game-ui` for the game shell, navigation, primitives, theme, quests, and notifications.
- `packages/backend/runtime/gameplay` for server-owned gameplay workflows.
- `packages/backend/convex/schema.ts` for the persisted game model.
- `packages/game-logic/src` for shared balance definitions and deterministic simulation helpers.

## Running Locally

Install dependencies:

```bash
bun install
```

Create and connect a Convex deployment:

```bash
bun run dev:setup
```

That runs `convex dev --configure --until-success` in `packages/backend`. Follow the Convex prompts, then copy the generated Convex values into the app env files.

For the web app, create `apps/web/.env`:

```bash
VITE_CONVEX_URL=https://<deployment>.convex.cloud
VITE_CONVEX_SITE_URL=https://<deployment>.convex.site
```

For the native app, create `apps/native/.env` if needed:

```bash
EXPO_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://<deployment>.convex.site
```

Configure backend environment variables in the Convex dashboard:

```bash
SITE_URL=http://localhost:3001
NATIVE_APP_URL=mybettertapp://
UNIVERSE_GEN_TOKEN=<choose-a-private-token>
```

Start the full development stack:

```bash
bun run dev
```

Or run pieces independently:

```bash
bun run dev:server
bun run dev:web
bun run dev:native
```

The web app runs at [http://localhost:3001](http://localhost:3001).

## World Generation

The Convex backend includes mutations for creating and maintaining universe capacity. They are protected by `UNIVERSE_GEN_TOKEN`.

There is also an offline galaxy asset generator:

```bash
bun run -F @nullvector/galaxy-generator generate \
  --out apps/web/public/generated/galaxies \
  --count 16 \
  --seed nullvector-galaxy-library-v1 \
  --overwrite true \
  --profile spiral-volumetric-v2
```

The generator produces deterministic GLB galaxy models and a typed manifest for the web client.

## Development Commands

```bash
bun run build
bun run check-types
bun run lint
bun run lint:fix
bun run format
bun run format:check
```

Backend tests can be run from the backend package:

```bash
bun run -F @nullvector/backend test
```
