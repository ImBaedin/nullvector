# NullVector Project State

## Overview

NullVector is a multiplayer space strategy game built as a TypeScript monorepo. The current implementation focuses on the core simulation and management loop: player onboarding, colony ownership, resource production, building and facility queues, ship construction, fleet missions, and a navigable universe map.

The project is no longer just a backend foundation spike. It already has a substantial web client, a server-authoritative Convex backend, and a shared gameplay package that keeps formulas and unlock logic consistent across frontend and backend.

## Product Direction

### Core fantasy

- Grow and manage colonies in a persistent instanced universe.
- Balance local resource production, storage, energy, and logistics.
- Build infrastructure and ships over time through queues.
- Move cargo and colony ships through space rather than relying on global storage.
- Navigate the world through a visual star map instead of only raw coordinates.

### Current MVP shape

The implemented MVP is centered on colony management and logistics rather than combat-heavy MMO features. The strongest completed slices today are:

- account/session bootstrap
- universe generation and exploration
- colony resource economy
- building and facility upgrades
- shipyard production
- fleet transport and colonization flows

Still clearly secondary or placeholder:

- native app experience
- research/contracts/combat depth
- alliances, trading, marketplace, PvE, moderation, narrative systems

## High-Level Architecture

### Monorepo

- `apps/web`: primary game client, built with React 19, Vite, and TanStack Router
- `apps/native`: Expo/React Native app, currently much lighter than the web app
- `packages/backend`: Convex schema, queries, mutations, auth, world generation, and server scheduling
- `packages/game-logic`: pure shared formulas, structure definitions, ship stats, costs, buffs, unlock rules, and DTO types
- `packages/env` and `packages/config`: shared environment/config support

### Platform choices

- frontend: React + TanStack Router + Tailwind-based custom game UI
- backend: Convex
- auth: Better Auth integrated with Convex
- package management/runtime: Bun
- monorepo orchestration: Turborepo

## Main Systems

### 1. Player and session bootstrap

- Users authenticate through Better Auth.
- Convex session bootstrap creates or resolves the player profile.
- First-time users are automatically assigned a starter colony on an unclaimed colonizable planet.
- The backend ensures world capacity exists before assigning a colony.

### 2. Universe generation and exploration

- The world model includes universes, galaxies, sectors, systems, and planets.
- World generation is deterministic and capacity-driven.
- Core-sector generation can expand when colonizable space runs low.
- The web app includes a real-data star map with hierarchical navigation from universe down to planet level.
- Colony and fleet UX now depend on star-map selection, not just manual coordinate entry.

### 3. Colony economy

- Resources are local to each colony.
- Economy tracks stored resources, storage caps, overflow, and accrual timestamps.
- Production is tickless and server-authoritative.
- Overflow is retained separately and pauses local production for that resource until storage headroom becomes available again.
- Energy and production behavior are derived from shared game-logic definitions rather than ad hoc UI calculations.

### 4. Buildings, facilities, and queues

- Standard economy buildings are implemented for production, power, and storage.
- Facilities currently include at least `robotics_hub` and `shipyard`.
- Queueing is lane-based, with separate concepts for building/facility progression and shipyard work.
- Queue items snapshot their payload and timing at enqueue time.
- UI and backend timing are driven by queue schedule metadata rather than a legacy single active-upgrade model.

### 5. Shipyard and fleet

- Ship building is implemented through the shipyard queue.
- Current ships include `smallCargo`, `largeCargo`, and `colonyShip`.
- Ship build cancellation is supported with refunds.
- Fleet missions support transport and colonization pathways in the current architecture, with broader mission enums reserved for future systems.
- Transport targeting can include other players' colonies when inbound policy allows.
- Fleet views are colony-scoped rather than empire-wide.

### 6. Server-owned timing and resolution

- Time-based resolution has moved to server-owned Convex scheduling.
- Colony queue completions and fleet due events are scheduled through internal scheduler functions.
- Client-side timed sync is no longer the normal completion path.
- `syncColony` still exists conceptually in older assumptions, but scheduled resolution is now the dominant architecture.

## Web App State

The web app is the main product surface today.

### Implemented route areas

- auth entry and session completion
- colony shell/layout
- resources view
- facilities view
- shipyard view
- fleet view
- standalone universe explorer
- style lab / UI exploration artifacts

### UX direction

- custom sci-fi interface rather than default CRUD styling
- shared game shell with resource strip, colony navigation, and context navigation
- integrated star-map overlay inside colony views
- optimistic-feeling live countdowns backed by authoritative backend state

## Backend State

### Data model

The Convex schema currently covers:

- world entities: universes, generation config, galaxies, sectors, systems, planets, planet economy
- player entities: players, colonies, colony economy, colony infrastructure, colony policy
- ship/fleet entities: colony ships, fleets, fleet operations, fleet results, fleet events
- queue entities: colony queue items and queue payloads
- tooling/support: dev console actions

### Organization

- `packages/backend/convex/*` exposes the public Convex API surface
- `packages/backend/runtime/gameplay/*` contains most shared backend gameplay logic
- shared runtime code is intentionally kept outside `convex/` when it should not become part of the generated API namespace

## Shared Game Logic

`packages/game-logic` is a key architectural boundary.

It centralizes:

- generator/building definitions
- facility definitions
- ship definitions and fleet math
- cost, duration, and production curves
- unlock rules
- shared gameplay DTOs and keys

This keeps balance logic and identifiers consistent between the backend and the web client.

## Current Strengths

- Clear separation between pure game logic, backend runtime, and UI.
- Strong server-authoritative model for economy, queues, and fleet timing.
- Real-data universe visualization is already integrated into gameplay.
- Session bootstrap creates a full playable starting state automatically.
- Monorepo structure is coherent and practical for shared types/formulas.

## Important Caveats

- The native app exists, but the web app is the substantially more complete client today.
- Some product domains are scaffolded in types/enums before they are fully implemented in gameplay.
- Facility definitions beyond the current core set are still placeholder-level in product terms.
- Fleet and queue behavior has evolved quickly; older docs or assumptions about sync-driven completion can be stale.

## Working Conventions

- Use root formatting/lint commands: `bun run format` and `bun run lint:fix`.
- For web auth with Convex, rely on `ConvexBetterAuthProvider` and `convexClient()` integration rather than manually fetching Convex auth tokens.
- When working in backend/web gameplay code, narrow queue payloads by `kind` before reading payload-specific fields.
- Prefer shared gameplay keys/types from `@nullvector/game-logic` rather than redefining them locally.

## Near-Term Focus Areas

- Continue deepening colony, shipyard, and fleet gameplay loops.
- Expand the universe/fleet UX built around the star map.
- Add more gameplay depth on top of the existing queue and scheduling architecture.
- Bring the native client closer to feature parity once the web loop is stable.

## One-Sentence Summary

NullVector is currently a web-first, server-authoritative space strategy game prototype with real universe generation, playable colony management, lane-based progression queues, ship production, and scheduled fleet logistics built on Convex.
