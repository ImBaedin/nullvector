# Project Core Concept (Bare-Bones Backend Foundations)

## One-sentence pitch

An asynchronous, cooperative-first space economy MMO (OGame-inspired) where players build and specialize colonies across an instanced universe, manage 3 resources + energy constraints, and move goods via ship transport (no instant/global storage).

## MVP Scope (strict)

Only backend foundations that everything else will build on:

- Universe spatial structure + coordinates (for visual display)
- Planet/system/sector/galaxy data model + generation
- Player ownership of planets (colonies) and non-relocatable buildings
- Tickless resource production + storage + energy throttling
- Ship-based transport between owned planets

Not in scope (explicitly ignore for now): PvE raids, contracts, research trees, alliances, trading, combat, marketplace, cosmetics, narrative events, chat, moderation.

---

## Tech Assumptions

- Backend: Convex (real-time reactive queries, server-authoritative mutations, scheduled jobs if needed)
- Frontend is out of scope except that the backend must support visual coordinate queries.

---

## Core World Model (hierarchy)

Universe contains:

- Galaxies
  - Sectors
    - Solar Systems
      - Planets

### Entities and responsibilities

- **Universe**: global config, coordinate conventions, deterministic generation seeds
- **Galaxy**: top-level partition for scalability / future sharding; contains sectors
- **Sector (instanced)**: the main scalable unit; can be spawned as needed; contains solar systems
- **Solar System**: contains star + orbiting planets; has a system coordinate within its sector
- **Planet**: colonizable body; has parameters that derive resource multipliers and slot count

---

## Coordinate System Requirements (backend must support)

We will render the map, so everything needs consistent coordinates.

### Coordinate model (to plan/implement)

Provide two layers of coordinates:

1. **Logical Address (stable identifiers)**

- `galaxyIndex`
- `sectorId` (or sectorIndex within galaxy)
- `systemIndex` (within sector)
- `planetIndex` (within system)

2. **Visual Coordinates (for rendering)**

- Sector-space 2D position for each solar system: `(x, y)`
- Optional galaxy-space offsets so galaxies can be rendered apart: `(gx, gy)` + sector-local coords
- Planet orbit info for in-system rendering:
  - `orbitRadius`
  - `orbitAngle` (for initial placement; can be static)

Backend must expose queries that return:

- Systems in a sector with `(x, y)` and summary info
- Planets in a system with orbit parameters and planet summary

Note: exact coordinate conventions can be decided during planning, but schema must store enough to render deterministically.

---

## Instanced Universe (Model A)

Goal: Always have room to colonize while still allowing exploration later.

### Core vs Frontier (MVP implementation)

- **Core sectors** exist and are always available for new colonies.
- **Frontier sectors** can be added later; for MVP, implement only the instancing mechanism:
  - ability to create a new sector instance when needed
  - sector has a `seed` and `galaxyIndex`

MVP does not need discovery gameplay; just ensure the world can expand.

---

## Planet Generation (rational, parameter-derived)

Planet bonuses are not arbitrary traits; they derive from parameters.

### Planet parameters to store (minimum viable)

- `planetSize` (drives building slot count)
- `orbitalDistance` (drives temperature band; used later for solar, etc.)
- `compositionType` (e.g., metallic / silicate / icy / volatile-rich)

### Derived, stored-once-at-creation values

- `maxBuildingSlots` (from planetSize)
- Resource multipliers (bounded):
  - `alloyMultiplier`
  - `crystalMultiplier`
  - `fuelMultiplier`

Keep multiplier ranges conservative for MVP (e.g., 0.85–1.25).

---

## Colony Model (player-owned planet state)

A **colony** is the player’s state on a planet.

### Key rules

- Buildings are **not relocatable**.
- Each planet has a **finite building slot count**.
- Resources are **planet-local** (no global bank).
- Energy is produced/consumed as flat rates; if insufficient, production is throttled.

### Minimum building set for foundational economy

(Names are placeholders; levels and costs can be tuned later)

- Alloy Mine (produces Alloy, consumes Energy)
- Crystal Mine (produces Crystal, consumes Energy)
- Fuel Refinery (produces Fuel, consumes Energy)
- Power Plant / Reactor (produces Energy)
- Storage: Alloy / Crystal / Fuel

Optional but helpful for transport foundations:

- Shipyard (to build cargo ships)

---

## Economy Foundations (tickless simulation)

Use “tickless accrual” to avoid real-time simulation overhead.

### Stored state per colony

- `resources`: current stored amounts for Alloy/Crystal/Fuel
- `storageCaps`: caps for each resource (derived from storage building levels)
- `buildings`: levels and slot usage
- `lastAccruedAt`: timestamp of last production accrual

### Accrual algorithm

On relevant reads/mutations:

1. Compute elapsed time since `lastAccruedAt`
2. Compute base production rates from building levels and planet multipliers
3. Compute energy ratio:
   - `k = min(1, energyProduced / energyConsumed)` (if consumed is 0, k=1)
4. Apply throttling: `effectiveRate = baseRate * k`
5. Add produced resources, capped at storage
6. Update `lastAccruedAt = now`

All calculations must be server-authoritative and deterministic.

---

## Transport Foundations (ship-based resource movement)

Resources move between owned planets only via transport missions.

### Transport mission (minimum viable)

- Origin colony
- Destination colony
- Cargo amounts (Alloy/Crystal/Fuel)
- Departure time, arrival time
- Fuel cost (can be a simple function of distance for MVP)
- Status: scheduled → inTransit → delivered

### Required backend support

- Compute travel time and fuel cost from coordinates:
  - distance between solar systems (sector-space)
  - optionally include orbit/planet offsets later
- Reserve cargo at departure (deduct from origin storage)
- Apply cargo at arrival (add to destination storage, capped or overflow-handled)
- Store mission records for UI to show in-transit shipments

Scheduled resolution:

- Either resolve on-demand when queried (idempotent) or via scheduled jobs at `arrivalAt`.

---

## Backend Data Model (tables / collections)

Minimum set (names are illustrative):

### World tables

- `universeConfig` (singleton): coordinate conventions, generation constants
- `galaxies`: galaxy metadata, global offsets for rendering
- `sectors`: `{ galaxyIndex, sectorIndex, seed, type(core|frontier), bounds, createdAt }`
- `systems`: `{ sectorId, systemIndex, x, y, starParams, seed }`
- `planets`: `{ systemId, planetIndex, orbitRadius, orbitalDistance, size, compositionType, maxBuildingSlots, multipliers }`

### Player/colony tables

- `players`
- `colonies`: `{ playerId, planetId, name, buildings, usedSlots, lastAccruedAt, resources }`

### Transport tables

- `ships` (optional MVP; can be abstracted as cargo capacity)
- `transports`: `{ playerId, originColonyId, destColonyId, cargo, fuelCost, departAt, arriveAt, status }`

---

## Critical Backend Queries (must exist)

- Get sector map: systems in a sector with `(x,y)` and summary
- Get system view: planets in a system with orbit info + colonization availability
- Get colony state: resources (accrued), buildings, energy produced/consumed, storage caps
- Get player transports: list + ETAs

## Critical Mutations (must exist)

- Create/select starting colony on a core planet
- Upgrade/build a building (respecting slot cap; no relocation)
- Rename colony (optional)
- Create transport mission (validate cargo, fuel, capacity, times)
- Resolve/claim transport arrival (idempotent)

---

## First Implementation Steps (agent checklist)

1. Decide and document coordinate conventions (logical + visual)
2. Implement world schema + deterministic generation:
   - create galaxy → sector → systems → planets
   - ensure queries return stable coordinates for rendering
3. Implement colony schema and tickless accrual with 3 resources + energy throttling
4. Implement building slot cap enforcement (non-relocatable buildings)
5. Implement transport missions between owned colonies using coordinates for time/cost
6. Add minimal tests/invariants:
   - accrual idempotency
   - storage cap correctness
   - transport cannot duplicate cargo
   - building cannot exceed slot cap

Done = you can create a universe, create a player colony, produce resources over time, and ship resources between colonies with predictable coordinates for visualization.
