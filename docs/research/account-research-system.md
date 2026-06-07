# Account Research System Research

Date: 2026-04-06

## Executive Summary

Adding an account-wide research system is reasonably possible in the current codebase.

The strongest signs:

- Shared game logic already supports `research_level` unlock checks and passes `researchLevels` through structure formulas.
- Queue models, queue validators, and queue lane views already reserve a `research` lane.
- The web colony shell already supports adding another colony tab that reads player-scoped state. The current header already mixes colony-scoped panels with player-scoped progression data.
- Player-owned Convex state already exists for progression and quests, so an account-wide research state fits the existing architecture.

The main work is not proving feasibility. The main work is removing hardcoded assumptions that only three facilities exist, then choosing a player-owned research state model that does not accidentally turn global research into a fake colony system.

My recommendation is:

1. Add a new colony facility such as `research_directorate` or `quantum_lab`.
2. Keep research ownership on the player, not on the colony.
3. Store research progress in new player-owned Convex tables instead of reusing `colonyQueueItems`.
4. Let colonies fund research with local resources, but let completed research unlock globally for the account.
5. Snapshot cost and duration at enqueue time, matching the current queue architecture for buildings, facilities, ships, and defenses.

## What Already Exists

### 1. Shared unlock plumbing already understands research

The shared logic package already has the right conceptual seam for research:

- `packages/game-logic/src/types.ts`
  - `CalculationContext` already includes `researchLevels`.
  - `UnlockRule` already includes `research_level`.
  - `FacilityCategory` already includes `"research"`.
- `packages/game-logic/src/unlocks.ts`
  - `isUnlockSatisfied` already resolves `research_level`.
- `packages/game-logic/README.md`
  - The examples already document `research_level`.
- `packages/game-logic/src/__tests__/game-logic.test.ts`
  - There is already test coverage proving mixed `research_level` and `facility_level` trees work.

This is a real foundation, not a speculative one.

### 2. Queue and view models already reserve research-shaped space

Research is already present as a lane in shared and backend queue types:

- `packages/game-logic/src/gameplay.ts`
  - `QueueLane` includes `"research"`.
- `packages/game-logic/src/queue.ts`
  - `LANE_QUEUE_CAPACITY.research = 2`.
  - `projectQueueLanes` already returns a `research` lane view.
- `packages/backend/convex/schema.ts`
  - `queueLaneValidator` includes `"research"`.
- `packages/backend/runtime/gameplay/shared.ts`
  - Queue validators and queue views include a `research` lane.

Important caveat:

- Queue payload unions do not include any research payload today.
- Scheduled queue resolution only settles colony building, shipyard, and defense work.
- The reserved lane is a helpful seam, but it is not a finished implementation.

### 3. The app already supports player-owned progression next to colony-owned screens

The UI is already built around a colony route that can read both colony-scoped and player-scoped data:

- `apps/web/src/routes/game/colony/$colonyId/facilities.tsx`
- `apps/web/src/routes/game/colony/$colonyId/shipyard.tsx`
- `apps/web/src/features/game-ui/header/use-header-data.tsx`

Those surfaces already read:

- colony-owned data through `useColonyView(...)`
- player-owned data through `api.progression.getOverview`

That means a `/game/colony/$colonyId/research` route is a natural fit even if the research tree itself is global.

### 4. Player-owned state patterns already exist in Convex

There is clear precedent for account-wide systems:

- `playerProgression`
- `playerQuestStates`
- `playerQuestMetrics`

Relevant files:

- `packages/backend/convex/schema.ts`
- `packages/backend/runtime/gameplay/progression.ts`
- `packages/backend/runtime/gameplay/quests.ts`

This matters because research should behave more like progression or quests than like colony buildings.

## Current Gaps And Hotspots

### 1. Facility support is heavily hardcoded to three keys

Research is feasible, but facility extensibility is not centralized yet.

Current hardcoded areas include:

- `packages/game-logic/src/gameplay.ts`
  - `FACILITY_KEYS = ["robotics_hub", "shipyard", "defense_grid"]`
- `packages/game-logic/src/colony-state.ts`
  - `computeFacilityLevels`
  - `setFacilityLevel`
  - `isFacilityCurrentlyUnlocked(... researchLevels: EMPTY_RESEARCH_LEVELS)`
- `packages/game-logic/src/colony-selectors.ts`
  - facility card order is hardcoded to the current three facilities
- `packages/backend/convex/schema.ts`
  - `facilityKeyValidator`
- `packages/backend/runtime/gameplay/shared.ts`
  - `facilityLevelFromColony`
  - `facilityLevelsFromColony`
  - `setFacilityLevelOnBuildings`
- `packages/backend/runtime/gameplay/progression.ts`
  - `facilityAccessValidator`
- `apps/web/src/features/colony-ui/queue-items.ts`
  - facility label map
- `apps/web/src/routes/game/colony/$colonyId/facilities.tsx`
  - visuals and labels
- `apps/web/src/routes/game/colony/$colonyId/index.tsx`
  - overview facility labels
- `packages/backend/runtime/gameplay/colonyOverview.ts`
  - overview facility labels and output array
- `packages/backend/runtime/gameplay/quests.ts`
  - quest colony facts facility map
- `packages/backend/runtime/gameplay/devConsole.ts`
  - editable facility patch validators

This does not block research. It does mean "add one facility" is a broader pass than "add one row to a registry."

### 2. Research context is wired through formulas, but always empty in active colony logic

Today, colony calculations explicitly pass empty research levels:

- `packages/game-logic/src/colony-state.ts`
  - `EMPTY_RESEARCH_LEVELS`
- `packages/backend/runtime/gameplay/shared.ts`
  - `EMPTY_RESEARCH_LEVELS`
- `packages/backend/runtime/gameplay/facilities.ts`
  - facility unlock checks currently use empty research state

So the codebase already understands research in principle, but no live gameplay path currently feeds real research levels into unlocks, costs, or durations.

### 3. Colony queues are the wrong ownership model for account-wide research

Even though the queue system has a `research` lane, the actual rows are still colony-owned:

- `colonyQueueItems.colonyId`
- `colonyQueuePayloads.colonyId`
- scheduling is stored on `colonyScheduling`
- the scheduler resolves queues per colony

For shared research, reusing colony queues would create awkward edge cases:

- Which colony "owns" the active global research?
- What happens if the player opens another colony and expects the same queue?
- Do research queue items duplicate across colonies, or live on just one colony page?

My recommendation is to not force a global system into a colony-owned queue table.

### 4. Research UI will need new navigation and quest highlight targets

Current tab infrastructure only understands:

- `overview`
- `resources`
- `facilities`
- `shipyard`
- `defenses`
- `fleet`
- `contracts`

Relevant files:

- `apps/web/src/features/game-ui/contracts/navigation.ts`
- `apps/web/src/features/game-ui/header/header-config.ts`
- `apps/web/src/features/game-ui/header/use-header-data.tsx`
- `packages/game-logic/src/progression.ts`
  - `HighlightTarget` does not yet include a research tab target

### 5. Credits are earned but not meaningfully spent today

This makes credits a strong candidate for research costs.

Current evidence:

- credits live on `playerProgression`
- credits are granted from quests and contracts
- credits are shown in the app header
- I did not find live gameplay spend paths using credits

Relevant files:

- `packages/backend/runtime/gameplay/progression.ts`
- `packages/backend/runtime/gameplay/quests.ts`
- `packages/backend/runtime/gameplay/fleetV2.ts`
- `apps/web/src/features/game-ui/header/app-header.tsx`

### 6. There is already precedent for latent, not-yet-wired facility content

One useful signal: the shared facility registry already defines `logistics_nexus`, but typed facility surfaces do not expose it yet.

Relevant files:

- `packages/game-logic/src/facilities.ts`
- `packages/game-logic/src/gameplay.ts`

That suggests the codebase is tolerant of "registry content ahead of full UI/backend rollout," but it also shows where research work can become inconsistent if enums and registries drift.

## Technical Implementation

### Recommended V1 Architecture

### Research ownership

Keep research account-wide.

Each colony should be able to:

- view the same tree
- contribute by upgrading the research facility
- pay to start new research from that colony

But completed unlocks should live on the player and apply everywhere immediately.

### New facility

Add one new facility. My preferred names:

- `research_directorate`
- `quantum_lab`
- `science_nexus`

Recommendation: `research_directorate`

Why:

- sounds strategic and account-relevant
- fits a shared tech tree better than a purely local "lab"
- reads cleanly next to `robotics_hub`, `shipyard`, and `defense_grid`

Suggested local facility role:

- prerequisite for opening the research tab
- reduces research duration for items queued from that colony
- unlocks deeper research tiers at higher local levels
- optionally increases account research queue size later

### Player-owned research state

I recommend new player-owned tables instead of extending `playerProgression` too far.

Suggested tables:

1. `playerResearchState`
   - `playerId`
   - `levels: Record<string, number>`
   - `createdAt`
   - `updatedAt`

2. `playerResearchQueueItems`
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
   - `resolvedAt?`
   - `costResources`
   - `costCredits`
   - `snapshot`

3. `playerResearchScheduling`
   - `playerId`
   - `resolutionJobId?`
   - `resolutionScheduledAt?`
   - `updatedAt`

Recommended `snapshot` fields:

- `originFacilityLevel`
- `durationSeconds`
- `costModifierApplied`
- `timeModifierApplied`

This mirrors the current queue philosophy:

- cost is deducted immediately
- timing is snapped at enqueue
- later facility upgrades do not retroactively rewrite old queue items

That is already how colony upgrades are modeled, so it will feel consistent.

### Why not reuse `colonyQueueItems`

I do not recommend storing account research in `colonyQueueItems`, even though a `research` lane already exists there.

Reasons:

- the queue rows are colony-owned, but the unlocks are player-owned
- every colony tab would need to special-case "global data living on a local row"
- scheduler and ownership rules become harder to reason about
- cancellation, notifications, and history become awkward when the queue is logically global

The existing `research` lane is still useful as proof that the UI and validators already think in terms of research as a first-class activity. It is just not the right storage owner for this design.

### Shared game-logic definitions

Add a new code-owned registry in `packages/game-logic`, similar to facilities and ships.

Suggested shape:

```ts
export const RESEARCH_KEYS = [
	"appliedMetallurgy",
	"crystalLatticing",
	"propulsionTheory",
	"colonialAdmin",
	"targetingArrays",
] as const;

export type ResearchKey = (typeof RESEARCH_KEYS)[number];

export type ResearchEffect =
	| {
			type: "resource_production_multiplier";
			resource: "alloy" | "crystal" | "fuel";
			multiplier: number;
	  }
	| { type: "building_cost_multiplier"; buildingKey: BuildingKey; multiplier: number }
	| { type: "building_time_multiplier"; buildingKey: BuildingKey; multiplier: number }
	| { type: "facility_unlock"; facilityKey: FacilityKey }
	| { type: "ship_unlock"; shipKey: ShipKey }
	| { type: "defense_unlock"; defenseKey: DefenseKey }
	| {
			type: "feature_unlock";
			featureKey: "research" | "fleet" | "contracts" | "defenses" | "shipyard";
	  }
	| { type: "contract_task_force_bonus"; amount: number };

export type ResearchDefinition = {
	key: ResearchKey;
	name: string;
	branch: "economy" | "logistics" | "military" | "colonization" | "science";
	tier: number;
	maxLevel: number;
	baseDurationSeconds: number;
	baseCost: {
		resources: Partial<Record<ResourceKey, number>>;
		credits: number;
	};
	prerequisites?: Array<
		| { kind: "researchLevel"; researchKey: ResearchKey; minLevel: number }
		| { kind: "facilityLevel"; facilityKey: FacilityKey; minLevel: number }
		| { kind: "rank"; minRank: number }
	>;
	effectsByLevel: ResearchEffect[][];
};
```

Important note:

For the research screen, a whole-tree query is acceptable. This is one of the few places in the app where a broader player-scoped query is justified because the screen itself is the whole concept.

### Backend query and mutation shape

Recommended narrow surfaces:

- `research.getTreeState`
  - player-owned unlocked levels, prerequisites, and next costs for the whole tree
- `research.getQueue`
  - active and pending research queue items
- `research.getColonyResearchContext`
  - current colony facility level plus spendable local resources
- `research.enqueue`
  - spend colony resources and player credits, create player queue item
- `research.cancel`
  - optional for v1, full refund or partial refund by policy

This matches the repo preference for source-aligned queries:

- tree state
- queue state
- colony spend context

instead of one stitched page response.

### Scheduler model

Clone the existing scheduling pattern, but at player scope:

- `reschedulePlayerResearchResolution(...)`
- `resolvePlayerResearchQueue`
- `rearmPlayerResearchResolution`

Suggested behavior:

- when queue is empty, clear the scheduled job id
- when queue changes, schedule the next due item
- when research completes, patch `playerResearchState.levels[...]`, mark the item completed, and schedule the next queue item

This is the cleanest way to keep research aligned with the server-owned timing architecture already used for colonies and fleet operations.

## Exact File Areas To Touch Later

### Shared game logic

- `packages/game-logic/src/gameplay.ts`
- `packages/game-logic/src/types.ts`
- `packages/game-logic/src/unlocks.ts`
- `packages/game-logic/src/facilities.ts`
- `packages/game-logic/src/colony-state.ts`
- `packages/game-logic/src/colony-selectors.ts`
- `packages/game-logic/src/progression.ts`
- new: `packages/game-logic/src/research.ts`

### Backend

- `packages/backend/convex/schema.ts`
- `packages/backend/runtime/gameplay/shared.ts`
- `packages/backend/runtime/gameplay/progression.ts`
- `packages/backend/runtime/gameplay/scheduling.ts`
- `packages/backend/runtime/gameplay/scheduler.ts`
- `packages/backend/runtime/gameplay/quests.ts`
- `packages/backend/runtime/gameplay/colonyOverview.ts`
- new: `packages/backend/runtime/gameplay/research.ts`
- new: `packages/backend/convex/research.ts`

### Web

- `apps/web/src/features/game-ui/contracts/navigation.ts`
- `apps/web/src/features/game-ui/header/header-config.ts`
- `apps/web/src/features/game-ui/header/use-header-data.tsx`
- `apps/web/src/features/colony-state/hooks.ts`
- `apps/web/src/features/game-ui/quests/format-objective.ts`
- new: `apps/web/src/routes/game/colony/$colonyId/research.tsx`
- likely new: `apps/web/src/features/colony-route/research-screen.tsx`

## Upgrade Suggestions And Tree Layout

### Recommended Tree Layout

I recommend a hybrid layout instead of a pure freeform web:

- horizontal tiers from left to right
- vertical branches by domain
- small cross-links only for capstones

Branches:

1. Economy
2. Logistics
3. Military
4. Colonization
5. Science

Why this layout works best:

- easier to read on desktop and mobile than a radial tree
- easy to gate by tier and prerequisite lines
- easy to add future branches without redesigning the whole screen
- matches how players already think about the game loop

### Node types

Use three node types:

1. Theory nodes
   - 3 to 5 levels
   - mostly numeric modifiers

2. Application nodes
   - 1 level
   - unlock buildings, ships, defenses, mission capabilities

3. Breakthrough nodes
   - 1 level
   - big branch capstones
   - visually larger, rarer, and more expensive

### Suggested visual language

- theory node: compact circular or hex node with level pips
- application node: rectangular card-node with unlock icon
- breakthrough node: large diamond or octagon with strong glow
- branch color accents:
  - economy: amber
  - logistics: cyan
  - military: rose
  - colonization: emerald
  - science: violet-blue

## Concrete Upgrade Suggestions

### Economy branch

- `applied_metallurgy`
  - effect: +3% alloy production per level
  - 5 levels
- `crystal_latticing`
  - effect: +3% crystal production per level
  - 5 levels
- `volatile_catalysis`
  - effect: +3% fuel production per level
  - 5 levels
- `grid_harmonics`
  - effect: -4% energy consumption for mines and refineries per level
  - 4 levels
- `storage_compression`
  - effect: +8% storage capacity per level
  - 4 levels
- `industrial_automation`
  - effect: -5% building upgrade time per level
  - 3 levels

### Logistics branch

- `cargo_lashing`
  - effect: +10% cargo capacity for cargo ships
  - 4 levels
- `route_optimization`
  - effect: -5% transport fuel cost per level
  - 4 levels
- `dock_coordination`
  - effect: -4% ship build time per level
  - 4 levels
- `fleet_telemetry`
  - effect: +5% civilian ship speed per level
  - 3 levels
- `contract_signal_analysis`
  - effect: +1 contract visible slot at level 1, higher reward weighting at later levels
  - 3 levels
- `parallel_hypotheses`
  - effect: +1 research queue slot
  - 1 level

### Military branch

- `shield_tuning`
  - effect: +6% shield dome effectiveness per level
  - 4 levels
- `fire_control_algorithms`
  - effect: +4% planetary defense attack per level
  - 4 levels
- `interceptor_doctrine`
  - effect: unlock interceptor bonuses and later unlock frigate branch
  - 3 levels
- `frigate_construction`
  - effect: unlock frigates
  - 1 level
- `cruiser_construction`
  - effect: unlock cruisers
  - 1 level
- `bomber_construction`
  - effect: unlock bombers
  - 1 level
- `munition_efficiency`
  - effect: -5% combat ship fuel cost per level
  - 3 levels

### Colonization branch

- `colonial_administration`
  - effect: prerequisite for advanced expansion techs
  - 3 levels
- `pioneer_logistics`
  - effect: -8% colony ship cost per level
  - 3 levels
- `frontier_bootstrapping`
  - effect: new colonies start with a small package of stored resources
  - 2 levels
- `terraforming_protocols`
  - effect: unlock advanced colony-support buildings later if added
  - 1 level
- `supply_line_doctrine`
  - effect: +transport throughput or reduced return-trip cost
  - 3 levels
- `expeditionary_command`
  - effect: +1 colony cap at a high tier
  - 1 level

I would not ship extra colony cap too early. It should be a capstone, not a baseline ladder reward.

### Science branch

- `archive_compression`
  - effect: -5% research credit cost per level
  - 4 levels
- `lab_standardization`
  - effect: -5% research duration per level
  - 4 levels
- `cross_domain_models`
  - effect: small global reduction to all research costs
  - 3 levels
- `sensor_theory`
  - effect: unlock future sensor-array facility or explorer bonuses
  - 1 level
- `command_simulation`
  - effect: unlock future command-nexus facility or fleet coordination bonuses
  - 1 level
- `deep_field_analysis`
  - effect: future-proof hook for exploration, frontier, anomaly, or hostile-intel systems
  - 1 level

## Suggested Unlocks By Research

Use research for things that should feel like knowledge, not just more levels.

Best candidates:

- new ships
- new defenses
- new facilities
- strong economic modifiers
- transport and colonization improvements
- higher contract reach or better contract intelligence

Good examples:

- frigates, cruisers, bombers should be research-gated, not only shipyard-gated
- future sensor or command facilities should be research-gated
- advanced defense units should be research-gated
- colony cap increases should be late, expensive, and rare

## Cost Suggestions

## Recommended V1 Cost Model

Use:

- colony resources
- player credits

Recommended split:

- economy research: crystal-heavy, moderate credits
- logistics research: alloy + crystal + credits
- military research: alloy + crystal + fuel + credits
- colonization research: crystal + fuel + credits
- science research: crystal + credits, lowest alloy share

Why this is the best first version:

- it immediately creates a use for credits
- it keeps research anchored to colony production
- it avoids adding a brand-new economy resource before the tree itself is proven

### V2 resource option

If you want stronger long-term loop integration, add a new account resource later:

- `researchData`
- `artifactFragments`
- `encryptedTelemetry`

Best acquisition sources:

- contracts
- raid defense results
- future frontier or anomaly gameplay

I would not make this a v1 dependency. It adds economy plumbing, reward plumbing, storage decisions, and UI complexity all at once.

## Game Loop Integration

Research should not become a detached menu where players click a button and forget the colony game.

The best ways to anchor it:

### 1. Colonies should still matter

Research is global, but colonies should still provide the means to advance it:

- local research facility level reduces enqueue duration
- local colony resources pay the cost
- higher crystal and power economy directly enable faster research cadence

### 2. Research should unlock real next actions

Every early and mid-tier research should point back into an existing loop:

- "Research completed: build this new facility"
- "Research completed: queue this ship"
- "Research completed: take harder contracts"
- "Research completed: found colonies more efficiently"

If a tech only gives an invisible +2% with no near-term decision, it should be paired with clearer unlocks.

### 3. Quests should introduce the system

Add a short research onboarding sequence:

- build Research Directorate
- complete first research
- unlock first ship or defense via research

That keeps the new system inside the current onboarding style instead of feeling bolted on.

### 4. Notifications should route back into colony play

When research completes:

- send a notification
- route to `/game/colony/$colonyId/research`
- show what new build, ship, defense, or branch opened

### 5. Expansion should improve research cadence

The global nature of research becomes healthy when new colonies make future research easier to afford.

That gives expansion another purpose beyond only resources and fleet staging.

## Recommended Rollout Plan

### Phase 1: De-risk facility extensibility

- add the new facility key and building mapping cleanly
- remove as many "exactly three facilities" assumptions as practical
- decide whether latent facilities like `logistics_nexus` should stay hidden or be normalized

### Phase 2: Add research definitions and player-owned state

- add research registry in `packages/game-logic`
- add `playerResearchState`
- add `playerResearchQueueItems`
- add scheduler plumbing

### Phase 3: Add the colony research route

- new `/game/colony/$colonyId/research` route
- update header config and context nav
- expose tree state, queue, and colony spend context through separate queries

### Phase 4: Wire research into unlocks and formulas

- pass live `researchLevels` into unlock checks
- gate new ships, defenses, or facilities by research
- add selected modifier effects to production, build duration, contract rules, and colonization systems

### Phase 5: Add quests and notifications

- first-lab quest
- first-research quest
- research-complete notifications

## Final Recommendation

The system is feasible and fits the repo well if it is treated as:

- player-owned unlock state
- colony-funded progression
- code-defined tree content
- scheduler-driven timed completion

I would not implement it as a fake colony queue.
I would not add a brand-new resource on day one.
I would not make research a passive global point generator first, because that creates the most timing complexity for the least player clarity.

The highest-leverage version is:

- one new research facility on colonies
- one new research tab inside the colony shell
- one player-owned research tree
- queue items that snapshot cost and duration at enqueue time
- research costs paid from local colony resources plus player credits
- unlocks that feed directly back into buildings, ships, defenses, contracts, and colonization
