# Research System Refined Plan

Date: 2026-04-07

This document merges the earlier feasibility research with the newer design notes in [my-research-notes.md](./my-research-notes.md). Where the two directions conflicted, this document follows the newer design notes and keeps only the compatible parts of the earlier technical recommendation.

## Working Direction

The current best-fit direction is:

- Research is account-wide.
- Research is started and viewed from colonies.
- The research tree is code-authored in `packages/game-logic`, including a hand-authored visual layout.
- The research UI uses a tab system, with one tree per tab.
- Each tree tab has its own color identity and background animation profile.
- The research background should use `Dither` (`apps/web/src/components/Dither.jsx`), exported and imported as `Dither`, customized per active tab during implementation.
- Buildings, facilities, ships, and defenses should unlock from specific research nodes, not from raw research facility level requirements.
- Research nodes should use account-wide research site count for tier access, not local research facility levels.
- The Research Directorate should be a one-time per-colony research site. Higher tiers require more built sites across owned colonies.
- Research should use a named, swappable currency family. For now, that family is called `meta-matter`.
- `meta-matter` comes in multiple rarities and is earned primarily from contracts, with rarity tied to contract difficulty.
- Research should stay inside the main loop by requiring both colony development and combat/contracts, not by becoming a detached meta-progression screen.

## Why This Fits The Codebase

This design is feasible without fighting the current architecture:

- Shared game logic already supports `research_level` unlock rules and already carries `researchLevels` in calculation context.
- The web colony shell already mixes colony-scoped and player-scoped data, so a colony `research` tab can safely display a player-owned tree.
- Player-owned systems already exist in Convex for progression and quests, so player-owned research state is an established pattern.
- The repo already treats major game definitions as code-owned registries in `packages/game-logic`, which matches a code-authored research tree.

Important caveat:

- The current queue lane named `research` lives in colony queue views, but the actual persisted queue ownership model is colony-owned. That is a poor fit for account-wide research. The implementation should use player-owned research tables and research scheduling instead of forcing global research into `colonyQueueItems`.

## Core Design

### 1. Research Facility

Add a new facility, tentatively:

- `research_directorate`

Role of the facility:

- unlocks access to the research tab
- counts as one account-wide research site
- supports tier unlocks through empire-wide site count

Locked V1 behavior:

- Research Directorate is a one-time facility with max level 1.
- tier 1 research requires 1 built research site
- tier 2 research requires 3 built research sites
- tier 3 research requires 5 built research sites
- research completion is global for the account
- research queue is single-item for now

This keeps the facility meaningful without making research colony-local or tying research eligibility to one colony's facility level.

### 2. Global Research Tree

The tree should be:

- code-authored
- hand-laid-out
- dependency-driven
- visually exploratory rather than auto-packed

That means the gameplay package should own both the gameplay rules and the intended UI layout coordinates.

Suggested file shape in `packages/game-logic`:

```ts
export const META_MATTER_RARITIES = ["common", "rare", "mythic"] as const;

export type MetaMatterRarity = (typeof META_MATTER_RARITIES)[number];

export type ResearchNodeDefinition = {
	id: ResearchKey;
	name: string;
	branch: ResearchBranchKey;
	tier: 1 | 2 | 3 | 4 | 5;
	description: string;
	position: { x: number; y: number };
	prerequisites: ResearchKey[];
	maxLevel: number;
	requiredResearchNetworkSize: number;
	costs: Array<{
		metaMatter: Partial<Record<MetaMatterRarity, number>>;
		resources?: Partial<ResourceBucket>;
		seconds: number;
	}>;
	effects: ResearchEffect[];
};
```

The important part is `position`. The UI should render authored coordinates instead of computing layout at runtime.

Naming recommendation:

- use `meta-matter` as the current display name
- centralize the label, rarity labels, icon references, and color tokens so the family can be renamed later without rewriting the system model

### 3. Research Node Types

The tree will be easier to balance and read if nodes fall into a few recognizable patterns:

- Theory nodes: broad passive modifiers such as production, storage, queue speed, or combat tuning.
- Unlock nodes: enable a new building, defense, ship, facility, or mission capability.
- Infrastructure nodes: improve how colonies participate in research, logistics, or production.
- Mastery nodes: branch capstones with stronger account-wide modifiers or system-rule changes.

Suggested visual language:

- circles for passive theory
- hexes for unlocks
- squares for infrastructure
- large framed nodes for branch capstones

This node-shape language should remain stable because it will inform both readability and the future icon set.

### 4. Branch Structure

A good first-pass layout is a central trunk with four or five major wings. This makes the tree readable and lets dependencies stay visible.

Suggested branch set:

### Applied Industry

Focus:

- alloy, crystal, fuel economy
- storage efficiency
- build-time reductions
- queue throughput

Sample nodes:

- Automated Smelting: `+alloy production %`
- Crystal Lattice Refinement: `+crystal production %`
- Fuel Compression: `+fuel storage %`
- Modular Assembly Standards: `-building upgrade time %`
- Distributed Robotics: `-facility upgrade time %`
- Industrial Overclock Doctrine: branch capstone, improves high-level colony throughput with a tradeoff or steep cost

### Military Systems

Focus:

- defense unlocks
- ship unlocks
- combat modifiers
- fleet survivability

Sample nodes:

- Point Defense Theory: unlock `laserTurret`
- Missile Guidance Suites: unlock `missileBattery`
- Reactor-Hardened Hulls: `+frigate/cruiser hull %`
- Advanced Strike Craft: unlock `bomber`
- Shield Field Modulation: unlock `shieldDome`
- Theater Command Systems: branch capstone, improves task force cap or fleet operation efficiency

### Expansion And Logistics

Focus:

- transport efficiency
- colonization support
- fleet range
- cargo handling
- empire scaling

Sample nodes:

- Cargo Standardization: `+cargo capacity %`
- Deep Space Refueling: `-fleet fuel cost %`
- Colonial Bureaucracy: `+colony cap support hook` or prerequisite for later progression coupling
- Frontier Supply Doctrine: `-colonization setup friction`
- Logistics Backbone: unlock or strengthen logistics-related facilities later if desired
- Interstellar Research Network: capstone that changes facility gating from per-colony to aggregate research capacity

### Scientific Infrastructure

Focus:

- research speed
- research queue size
- cross-colony research support
- point conversion or efficiency

Sample nodes:

- Archive Compression: `-research duration %`
- Experimental Methodology: `+meta-matter efficiency` or reduced `meta-matter` costs on low-tier tech
- Parallel Inquiry: `+1 research queue slot`
- Peer Review Protocols: small refund on cancellation or reduced failure waste if failure states ever exist
- Federated Databanks: improves benefits of multiple research colonies
- Unified Theory Initiative: capstone for late-game research pacing

### Colony Specialization

Focus:

- building/facility unlocks
- specialization hooks
- stronger colony identity

Sample nodes:

- Defense Grid Architecture: unlock `defense_grid`
- Naval Production Coordination: unlock `shipyard`
- Advanced Robotics Administration: unlock higher robotics effects
- Planetary Survey Methods: unlock future scanning/sensor features
- Controlled Automation: branch capstone that improves specialized colony outputs

This branch is optional for V1. If the initial tree is too large, some of these unlock nodes can live inside Applied Industry or Military Systems instead.

### Tree Layout Recommendation

Recommended overall layout:

- center column: account progression and research infrastructure
- upper-left wing: Applied Industry
- lower-left wing: Expansion And Logistics
- upper-right wing: Military Systems
- lower-right wing: Colony Specialization or Scientific Infrastructure

This creates a star-chart feel rather than a generic RPG talent page.

Recommended visual rules:

- every node should show its parent links at all zoom levels
- locked nodes should still reveal their silhouette and dependency path
- locked nodes can hide detailed information while still showing that a node exists
- major unlock nodes should use distinct art frames
- branch capstones should be visible from the default zoom
- the overall aesthetic should sit between blueprint and mystical
- switching tabs should swap both the visible tree and the Dither background color profile

Recommended tab structure:

- each tree belongs to a tab
- each tab owns a theme color
- each tab can define its own Dither palette/options
- selected node details live outside the canvas so the background can stay expressive

### 5. Unlock Philosophy

The newer design direction is correct: facilities, defenses, ships, and buildings should not unlock from raw research facility level alone.

Use this split:

- research site count gates whether a research tier can be accessed
- research node completion gates whether specific content becomes available

Example:

- `bomber` should unlock from `Advanced Strike Craft`
- `shieldDome` should unlock from `Shield Field Modulation`
- future buildings should unlock from dedicated infrastructure techs
- research should gate the items inside `shipyard` and `defense_grid`, not the facilities themselves

This makes the tree feel meaningful and readable. It also prevents the research facility from being a disguised meta-level requirement for everything.

### 6. Research Network Size

The research facility should be a one-time research site per colony. This solves late-game scaling without making the origin colony's facility level decide which account-wide research can start.

Recommended implementation:

- each owned colony with a built `research_directorate` contributes 1 research site
- tier 1 requires 1 research site
- tier 2 requires 3 research sites
- tier 3 requires 5 research sites
- node-specific gameplay gates still use relevant achievements such as contracts completed, colonies founded, or meta-matter earned

Best rule for clarity:

- normal tier access uses account-wide research site count
- the UI should say `Requires 3 research sites`, not `Requires Research Directorate level 10`
- individual nodes should still use authored prerequisites and branch-specific tier gates

## Research Currency

### Recommended V1 Economy

Use a hybrid cost model:

- specialized `meta-matter` as the primary gating currency
- colony resources as a secondary activation cost

This preserves the best parts of both ideas:

- contracts and combat matter because they generate `meta-matter`
- colony economy matters because starting research still consumes alloy/crystal/fuel
- players cannot ignore either side of the game loop

### Meta-Matter Tiers

Recommended first pass:

- `common`
- `rare`
- `mythic`

These are rarities of `meta-matter`, not separate named currencies.

Suggested acquisition:

- lower-tier contracts mostly grant `common`
- mid-tier contracts grant `common` plus some `rare`
- high-tier contracts grant `rare` with a chance or guarantee of `mythic`
- special missions or future raid/contract variants can become the best source of `mythic`

Recommended V1 rule:

- grant `meta-matter` only on contract success
- tie reward amounts directly to `difficultyTier`
- keep the resource type mix deterministic by tier so players can plan routes

Example:

- difficulty tier 1-2: mostly `common`
- difficulty tier 3-4: `common + rare`
- difficulty tier 5+: `rare + mythic`

Late-game economy rule:

- some lower-tier `meta-matter` costs should remain relevant in later nodes
- some later systems should also require mid/high-tier `meta-matter`
- the economy should be mixed rather than strictly replacing early tiers

This fits the existing contract snapshot model, which already stores `difficultyTier`.

### Why Not Use Credits As The Main Research Cost

Earlier research suggested credits as a good fit because credits are underused. That is still technically true, but it conflicts with the new direction of tiered research currencies tied to contracts.

The cleaner merged recommendation is:

- do not make credits the primary research currency
- if credits are used at all, use them as a small auxiliary sink later

For V1, the cleaner model is:

- spend `meta-matter`
- spend local resources
- do not also charge credits unless balance needs another sink

## Implementation Plan

### 1. Shared Game Logic

Add a new `research.ts` module in `packages/game-logic/src` with:

- `RESEARCH_KEYS`
- `ResearchKey`
- `MetaMatterRarity`
- `ResearchBranchKey`
- `ResearchNodeDefinition`
- `ResearchEffect`
- `DEFAULT_RESEARCH_TREE`
- helpers for:
  - checking prerequisites
  - checking facility requirements
  - resolving effective research levels
  - applying research unlocks/modifiers

Add authored layout metadata directly to the definitions.

Recommended metadata additions:

- `tabKey`
- `tabLabel`
- `themeColor`
- `backgroundProfile`
- `nodeShape`
- `iconStyleFamily`

Recommended effect types:

This is a non-exhaustive V1 set. Keep the planned `ResearchEffect` union aligned with [Effect Model Gaps To Plan For](./research-tree-tier-three-first-pass.md#effect-model-gaps-to-plan-for) as tier-three effects are implemented.

- `unlock_building`
- `unlock_facility`
- `unlock_ship`
- `unlock_defense`
- `resource_production_multiplier`
- `resource_storage_multiplier`
- `building_upgrade_time_multiplier`
- `facility_upgrade_time_multiplier`
- `ship_build_time_multiplier`
- `fleet_fuel_cost_multiplier`
- `cargo_capacity_multiplier`
- `contract_reward_meta_matter`
- `research_network_synchronization`

`research_network_synchronization` increases account-wide research throughput based on the number of built research sites. The effect list should stay narrow at first. Avoid a generic free-form scripting model in V1.

### 2. Backend Data Model

Add player-owned research tables in `packages/backend/convex/schema.ts`.

Recommended tables:

#### `playerResearchState`

- `playerId`
- `levels`
- `unlockedAtByKey`
- `createdAt`
- `updatedAt`

Where:

- `levels` is `Record<ResearchKey, number>`
- single-rank nodes are just level `1`
- repeatable/passive nodes can go above `1`

#### `playerResearchPoints`

- `playerId`
- `common`
- `rare`
- `mythic`
- `updatedAt`

This stays separate from progression because it is a different economy.

Implementation note:

- internal naming can stay generic if helpful
- the user-facing name should be sourced from a single `meta-matter` label constant so it can be renamed later with minimal churn

#### `playerResearchQueueItems`

- `playerId`
- `originColonyId`
- `researchKey`
- `fromLevel`
- `toLevel`
- `status`
- `order`
- `queuedAt`
- `startsAt`
- `completesAt`
- `resolvedAt`
- `snapshot`
- `costMetaMatter`
- `costResources`

Suggested snapshot fields:

- `originResearchSiteBuilt`
- `researchNetworkSize`
- `durationSeconds`
- `metaMatterCostAtEnqueue`
- `resourceCostAtEnqueue`

#### `playerResearchScheduling`

- `playerId`
- `nextResearchCompletionAt`
- `resolutionJobId`
- `updatedAt`

This mirrors the repo's server-owned timing pattern without pretending the queue belongs to any single colony.

Queue behavior:

- only one active research item in V1
- cancelling research grants a full refund

### 3. Backend Functions

Add a new backend runtime module:

- `packages/backend/runtime/gameplay/research.ts`

Suggested responsibilities:

- `ensurePlayerResearchState`
- `ensurePlayerResearchPoints`
- `getResearchOverview`
- `enqueueResearch`
- `cancelResearch`
- `settleResearchQueue`
- `grantMetaMatter`
- `reconcileResearchSchedule`
- `getEffectiveResearchFacilityCapacity`

Expose Convex functions such as:

- `research.getTree`
- `research.getOverview`
- `research.enqueue`
- `research.cancel`

`getTree` can return static code-owned data plus player-specific unlock annotations.

Recommended overview payload additions:

- active tab id
- per-tab theme metadata
- `meta-matter` balances by rarity
- research network size
- current active research item

### 4. Contract Reward Plumbing

Contract reward plumbing is the cleanest source for `meta-matter` in V1 because:

- contracts already have `difficultyTier`
- contract resolution already grants other player-owned rewards
- contract results already persist a reward snapshot

Recommended change:

- extend contract result resolution in `packages/backend/runtime/gameplay/fleetV2.ts`
- after contract success, call `grantMetaMatter(...)`
- map `difficultyTier` to a `meta-matter` bundle

Suggested first-pass reward mapping:

- tier 1: `common`
- tier 2: more `common`
- tier 3: `common + small rare`
- tier 4: moderate `rare`
- tier 5+: `rare + mythic`

If needed, add a shared helper in `packages/game-logic/src/contracts.ts` or a new research-economy helper so this mapping is code-owned and testable.

### 5. Unlock Integration

Research effects should be read alongside progression and facility state when determining access.

That means eventually wiring research checks into:

- facility unlock resolution
- defense unlock resolution
- ship unlock resolution
- future building unlock resolution
- modifier application for production, queue speed, and fleet behavior

Short-term implementation rule:

- keep existing live unlock paths stable where changing them would create regressions
- add research-gated unlocks first for new content or clearly isolated content
- migrate older unlock rules to research once the system is stable

### 6. Web UI

Add a new colony route:

- `/game/colony/$colonyId/research`

The route should load:

- static tree data from `packages/game-logic`
- player research state and queue from Convex
- account-wide research network size and local resources

Core panels:

- tree tab strip
- tree canvas
- selected node detail
- account research queue
- `meta-matter` balances
- origin colony status and current research site count

Recommended interaction model:

- switch between tree tabs
- tab switching updates the tree content and background profile
- click node to inspect
- see prerequisites and unmet requirements
- use current colony resources as the research origin cost source
- enqueue if costs and requirements are met

If the user switches colonies:

- the same global tree remains visible
- local launch eligibility updates based on that colony's resource stockpile while tier eligibility stays account-wide

That is exactly the behavior we want from a player-owned system launched from colony context.

### 7. Navigation And Quest Support

Planned supporting changes:

- add `research` to colony tab navigation
- add a new `HighlightTarget` such as `tab-research`
- add a research icon to the header config
- optionally add onboarding quests for:
  - build the first Research Directorate
  - complete first research node
  - earn first rare `meta-matter`

## How Research Fits The Main Loop

The system should reinforce the existing loop rather than bypass it.

Recommended loop:

1. Improve colonies to afford the one-time `research_directorate` site.
2. Run contracts to earn `meta-matter` of different rarities.
3. Return to a colony and start research using both global `meta-matter` and local resources.
4. Unlock stronger ships, defenses, buildings, and passive modifiers.
5. Use those upgrades to push harder contracts and expand the empire.
6. Build research sites on more colonies to unlock higher research tiers.

This is the key structural win:

- colony play matters
- combat/contracts matter
- research matters
- none of the three fully replaces the others

## Recommended V1 Scope

Keep V1 narrow enough to ship:

- one new facility: `research_directorate`
- one new colony tab: `research`
- one player-owned research tree
- one active research slot, player-owned
- three `meta-matter` rarities
- contract-success `meta-matter` rewards
- a modest first tree with 20-30 nodes
- research-driven unlocks for a small set of new or isolated content first

Avoid for V1:

- auto-generated tree layout
- respec/reset system
- branching failure states
- converting every existing unlock in the game immediately
- more than one active research item at a time

## Suggested Initial Node Set

This is a tighter V1-friendly set than the broader brainstorm list.

### Core Spine

- Research Network Protocols
- Archive Compression
- Parallel Inquiry
- Federated Databanks
- Unified Theory Initiative

### Applied Industry

- Automated Smelting
- Crystal Lattice Refinement
- Fuel Compression
- Modular Assembly Standards
- Distributed Robotics

### Military Systems

- Point Defense Theory
- Missile Guidance Suites
- Shield Field Modulation
- Advanced Strike Craft
- Reactor-Hardened Hulls

### Expansion And Logistics

- Cargo Standardization
- Deep Space Refueling
- Frontier Supply Doctrine
- Colonial Bureaucracy
- Interstellar Research Network

### Colony Specialization Or Science Wing

- Defense Grid Architecture
- Naval Production Coordination
- Experimental Methodology
- Planetary Survey Methods
- Controlled Automation

## Resolved Decisions

- research currency family name is `meta-matter` for now, and it should be easy to rename later
- research UI uses tabbed trees
- each tree has its own color identity
- tab switching updates the Dither background palette and visible tree
- research queue is single-item in V1
- research site count affects tier eligibility
- late-game research access uses the count of owned colonies with a built Research Directorate
- research gates shipyard and defense-grid contents, not the facilities themselves
- V1 `meta-matter` source is contract success only
- lower-tier rarities should remain partially relevant in the late game
- locked nodes remain visible as silhouettes with hidden details
- node leveling is mixed: some one-time, some multi-rank
- research cancellation gives a full refund
- visual direction is blueprint plus mystical
- node-shape language should carry meaning and stay consistent with future icon work

## Remaining Questions

These are the questions still worth answering before implementation.

1. What should the actual tree tabs be called, and how many should ship in V1?
2. What color identity should each tab use?
3. What should the long-term rarity names be if `common / rare / mythic` are only placeholders?
4. Which node shapes map to which gameplay meanings: passive, unlock, infrastructure, capstone, repeatable?
5. What icon style should define the tree set so art production can start against a stable direction?
6. Which existing ships and defenses should move first to research-node unlocks in V1?
7. Should all tree tabs be visible immediately, or should some appear only after progression or early research milestones?
8. Should locked nodes hide only effect details, or also hide exact costs and level caps?

## Current Recommendation

If we proceed into implementation soon, the strongest next step is:

1. formalize the one-time `research_directorate` facility
2. add a code-owned research tree registry with authored layout metadata
3. add player-owned research state, `meta-matter` balances, queue, and scheduling
4. award `meta-matter` from contract success by `difficultyTier`
5. add the colony `research` tab with tabbed trees and themed background behavior

That sequence gets the system standing up without forcing a full migration of every existing unlock path on day one.
