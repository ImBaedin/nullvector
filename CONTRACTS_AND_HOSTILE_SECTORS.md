# Contracts And Hostile Sectors

## Purpose

This document captures the current agreed direction for the contract system, hostile territory, and related progression systems before backend implementation begins.

The goal is to lock the gameplay model first, then derive backend schema, runtime logic, and UI work from it.

## Agreed So Far

### Contract model

- Contracts are fleet missions.
- Contracts should resolve deterministically.
- There are no random rolls in contract resolution.
- Outcomes come from pure simulation using mission inputs and game state.
- The intended loop is: fleets in, fleets/rewards out.

### Fleet mission relationship

- Contracts should use the existing fleet travel framework rather than bypassing it.
- A fleet is dispatched to a contract destination in the galaxy.
- Contract resolution should happen through server-authoritative scheduled fleet settlement.
- `contract` already exists as a reserved fleet operation kind in the current schema/runtime, but it is not implemented yet.

### Combat philosophy

- The user wants hostile NPC-controlled space in the same universe.
- The system should support combat-capable fleets and deterministic combat simulation.
- This is not intended to be roll-based combat.
- The first implementation can stay focused on contract-specific deterministic simulation rather than a full open-ended PvE/PvP combat engine.

### Hostile territory

- Galaxies or sectors can generate with hostile inhabitants.
- Hostile control exists within the same persistent universe as player space.
- Hostile-controlled planets cannot be colonized while the hostile presence remains.
- Players can chip away at hostile control by completing relevant contracts.
- Hostility is tracked per planet.
- Every planet within a hostile sector starts hostile-controlled.
- Planets inside hostile sectors can later be individually cleared.
- A planet must be cleared and no longer hostile in order to be colonizable.
- A sector becomes colonizable only once all hostile-controlled planets in that sector are cleared.

### Hostile factions

- There will be multiple hostile NPC faction types.
- Example factions mentioned so far:
  - space pirates
  - rogue AI
- Entire hostile sectors belong to exactly one hostile faction.
- At least initially, faction differences are mostly presentation:
  - different text
  - different color treatment
  - different inhabited-sector labeling
- Mechanics can remain shared at first unless later design requires faction-specific behavior.
- The system should be architected so faction-specific modifiers can be added later.

### Territory-clearing loop

- A hostile sector starts under NPC control.
- Hostile control is tracked on each hostile planet as a single numeric pool.
- Contracts associated with that hostile territory can be completed by players.
- Contracts are generated per player, per hostile planet.
- Different players can see different contracts for the same planet based on factors like rank.
- Players initially see 2 active contracts per hostile planet.
- Contract count should increase with player rank over time.
- Multiple players can run different contracts against the same hostile planet at the same time.
- Completing successful contracts reduces that planet's hostile control pool.
- Control reduction is determined by the contract's predefined value.
- Failed contracts do not reduce hostile control.
- Once every hostile planet in a sector has been cleared, the sector is considered cleared.
- Once the sector is cleared, colonizable planets in that sector unlock for player colonization.
- Sector clear unlock is global and immediate for all players in the universe.

## Current Recommended MVP Shape

This is not fully locked yet, but it is the current recommended direction based on the discussion so far.

### Scope

- Track hostility per hostile planet, with sector colonization unlock determined by all hostile planets in the sector being cleared.
- Keep hostile factions mostly cosmetic in MVP.
- Use deterministic contract generation and deterministic mission resolution.
- Use a simple numeric control pool for hostile planet progress.
- Make hostile progress global and shared across players in the same universe.
- Unlock colonization for all eligible planets in a sector when all hostile planets in that sector reach zero control.
- Start with 2 active contracts per player per hostile planet, scaling upward with player rank.
- Allow contracts to refresh on a timer and through completion.
- Drive contract difficulty primarily from player rank.
- Resolve contracts against a mix of hostile fleet and static defense values, with mission type controlling the blend.
- On failure, surviving ships return home.
- Reward contracts with credits and rank XP, and sometimes resources.
- Keep accepted contracts visible in the player's contract list, but lock them while in progress.
- Snapshot contract state at creation/acceptance so in-flight missions resolve against the accepted contract snapshot.
- Use the same travel-time and fuel rules as existing fleet missions.
- Discard excess control reduction when a contract would push a planet below zero control.
- Accepted contracts no longer expire once accepted.
- Replacement offers can appear immediately after a contract resolves.
- Rank is represented as a numeric value in MVP.
- Rank unlocks harder contracts, more visible contract slots, and mission-type access.
- The first mission catalog can be treated as different combat contract flavors.

### First-pass supporting systems

- Player-level credits for contract rewards.
- Player rank/progression used for contract access and scaling.
- Combat-capable ship definitions.
- Deterministic mission resolver.
- Contract persistence and history.
- Sector control state and explorer overlays.

## Systems Identified As Required

### Contracts

- contract offer generation
- contract ownership/visibility rules
- contract acceptance rules
- assigned fleet tracking
- contract refresh rules
- locked in-progress offer state
- contract snapshot persistence
- expiration rules
- completion/failure rules
- reward definition and payout
- mission report/history records

### Hostile territory

- hostile faction identity
- hostile sector generation
- hostile planet control value/progress
- sector clear state
- hostile planet clear state
- colonization lock enforcement
- map/explorer visual overlays

### Fleet and combat

- extensible mission type catalog
- combat ship roster
- combat-relevant ship stats
- deterministic fleet-vs-target simulation
- combat-focused MVP resolution flow
- support for mixed-role missions
- support for future account-wide research modifiers
- ship loss / survival rules
- travel + resolution scheduling integration

### Progression and economy

- player credits
- player rank
- player rank XP
- tunable rank progression curve
- account-wide research modifiers in the future
- unlock/gating rules
- reward scaling rules

## Locked Decisions

These decisions are now considered agreed unless explicitly changed later.

1. Hostile-control progress is global and shared across players.
2. Hostility is tracked per planet, not only per sector.
3. A sector becomes colonizable only when all hostile planets in that sector are cleared.
4. Hostile contracts are generated per player and per planet.
5. Different players can see different contracts for the same hostile planet.
6. Each hostile planet uses a single numeric control pool.
7. Factions are cosmetic-only in MVP, but the architecture should allow future mechanical modifiers.
8. Credits are player-global, not colony-local.
9. Starter colonies must always avoid hostile sectors.
10. Failed contracts do not contribute to hostile-control reduction.
11. Entire hostile sectors belong to exactly one hostile faction.
12. Every planet inside a hostile sector starts hostile-controlled.
13. A planet must be cleared before it can be colonized.
14. Players initially see 2 active contracts per hostile planet.
15. Contract count can scale upward with player rank.
16. Contracts may refresh both on a timer and on completion.
17. Contract difficulty is driven by player rank.
18. Control reduction uses predefined contract values.
19. Contracts resolve against both hostile fleet and static defense values, with mission type controlling the mix.
20. On failure, surviving ships return home.
21. Rank is used for both gating and reward scaling.
22. Contracts reward rank XP, and may also reward resources in addition to credits.
23. Sector clear unlocks colonization immediately for all players in the universe.
24. Multiple players can run different contracts against the same hostile planet at the same time.
25. Accepted contracts remain visible but are locked while in progress.
26. In-flight missions resolve from the accepted contract snapshot even if planet control changes before arrival.
27. If a planet is cleared before arrival, the mission still resolves from the accepted contract snapshot.
28. Mission types should come from an extensible catalog rather than hardcoded one-offs.
29. Mission-type fleet/defense ratios are decided at contract creation.
30. Contracts can be mixed-role rather than combat-only.
31. An overwhelming fleet can succeed with zero losses.
32. Contract travel time and fuel use the same rules as existing fleet missions.
33. Excess control reduction is discarded once a planet reaches zero control.
34. Rank XP should use a tunable curve.
35. Rewards are snapshotted rather than recalculated at completion.
36. Resource rewards are returned as fleet cargo.
37. Combat resolution should take inspiration from OGame-style fleet-vs-defense combat, but without random chance.
38. MVP should focus on combat contracts first.
39. Rank is represented numerically in MVP.
40. Rank unlocks mission types, harder contracts, and more visible contract slots.
41. Accepted contracts stop expiring once accepted.
42. Replacement offers can appear immediately after a contract resolves.
43. Initial combat contract flavor seed list:
    - Cruiser takedown
    - Bombing run
    - Glass production facilities
    - Supply interception
    - Defense grid sabotage
    - Command bunker strike
    - Occupation convoy raid
    - Recon in force
44. Ship combat stats in MVP should include attack, shield, hull, cargo, speed, and fuel usage.
45. Rapid fire is out of scope for MVP ship stats.
46. Research modifiers are not ship stats; they are future account-wide modifiers applied during simulation.
47. Defense stats in MVP should include attack, shield, and hull.
48. Combat should run in deterministic rounds.
49. Combat should last up to 6 rounds.
50. Target selection should be deterministic, using priority ordering plus remaining unit counts.
51. Enemy fleets and defenses are engagement-specific snapshots, not persistent world inventories.
52. Failed contracts grant a small pity amount of rank XP.
53. Aggregate damage should focus one target type at a time and spill over only after that target stack is destroyed.
54. Shields fully refresh at the start of each round.
55. Surviving units retain partial hull damage across rounds.
56. Partial damage should be tracked on the front unit of a stack.
57. If the attacker has not won by the end of round 6, the contract is a failure/stalemate: survivors return home, control is not reduced, and only pity XP is awarded.

## Open Design Questions

These need answers before backend schema and runtime implementation can be planned cleanly.

### Deterministic combat resolution

Combat-resolution rules are now sufficiently specified for backend planning:

- combat runs for up to 6 deterministic rounds
- both sides may fire each round if they still have valid units
- targeting is deterministic by priority ordering and remaining unit counts
- aggregated damage focuses one target stack at a time, then spills over
- shields refresh fully at the start of each round
- hull damage persists across rounds
- partial damage is tracked on the front unit in each stack
- attacker success requires destroying all snapshotted hostile fleet and defense forces within 6 rounds
- if the attacker is destroyed, the mission fails
- if hostile forces remain after round 6, the mission fails as a stalemate
- on failed contracts, surviving attacker ships return home and only pity XP is awarded
- on successful contracts, surviving attacker ships return home with rewards and the contract's snapshotted control reduction is applied

## Combat Direction Proposal

The current recommendation is:

- use one shared deterministic combat resolver for all combat contracts
- vary mission flavor through contract templates and mission parameters
- snapshot enemy fleet composition, defense composition, rewards, and control reduction at contract creation
- run combat in deterministic rounds inspired by OGame structure
- return surviving attacker ships home with any rewarded cargo
- apply control reduction only on successful completion
- keep the initial implementation limited to one shared combat resolver used by all combat-flavored mission templates

## Backend Implications Already Visible

These are not implementation tasks yet, just consequences of the agreed direction.

- The existing fleet schema already reserves:
  - `fleetOperations.kind = "contract"`
  - `fleetOperations.kind = "combat"`
  - `fleets.locationKind = "contractNode"`
  - `fleetOperations.target.kind = "contractNode"`
- The current fleet runtime only allows `transport` and `colonize` creation.
- There is currently no persisted schema for:
  - hostile factions
  - hostile sector and planet control
  - contracts
  - player credits
  - player rank
  - combat ship stats beyond logistics ships

## Suggested Next Step

Answer the open questions above, reduce them into a locked MVP ruleset, and then produce:

1. backend schema changes
2. shared game-logic API for deterministic mission resolution
3. fleet runtime integration plan
4. UI surface plan
