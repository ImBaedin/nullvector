# Research Product Decisions

Last updated: 2026-04-11

## Canonical Direction

- Favor the frontend mock-up for the overall product shape of the research system.
- Keep five research branches.
- Use camelCase identifiers everywhere. Do not preserve snake_case research ids or branch keys.
- Treat the backend/shared game-logic layer as the canonical place for gameplay semantics.
- Treat mock-up-only visual/demo data as non-authoritative unless explicitly adopted here.
- Keep the research queue as a single account-wide active item for the first pass.
- Keep backend cancellation semantics for the first pass.
- Use the radial tree presentation as the target UI layout.

## Branch Structure

The first-pass research product should use these five branches:

- `appliedIndustry`
- `militarySystems`
- `scientificInfrastructure`
- `expansionLogistics`
- `colonySpecialization`

Notes:

- The shared research tree now includes all five first-pass branches.
- Existing snake_case mock branch keys are prototype-only and should not be used by the integrated research screen.

## Identifiers

- Research node ids should use camelCase.
- Branch keys should use camelCase.
- Any old snake_case mock ids are transitional and should not survive into the integrated implementation.
- Do not retain snake_case research ids or branch keys at route/UI boundaries unless forced by an unrelated external API.
- The integrated system should have one canonical research id per node shared by backend and frontend.

## Status And Visibility

Canonical visibility/status model for the integrated product:

- Backend visibility rules should remain the source of truth for whether a node is hidden or revealed.
- We still need a distinct `researching` presentation state in the UI for the single active node.
- Branch-wide tier unlocks gate both visibility and startability.
- Prerequisite nodes also gate visibility.

Working model:

- Visibility layer:
  - `hidden`
  - `silhouette`
  - `visible`
- Activity overlay:
  - `researching` applies to the currently active node

Implication:

- The final frontend should not rely on hand-authored per-node mock statuses like `available` or `locked` as source-of-truth data.
- Instead, UI state should be derived from backend/shared visibility plus player levels plus the active queue item.
- Silhouette nodes should still show the full card shape, but effects and costs should be obscured.
- Visible nodes that cannot currently be started because of unmet requirements should still look like visible nodes. Their unmet requirements should be shown in the details card with error styling, such as red text.
- A node should only become visible if its branch tier is unlocked and its prerequisite visibility rule is satisfied.
- A node should only become startable if its branch tier is unlocked, prerequisite nodes are complete, and all node-specific requirements are met.

## Queue And Cancellation

- Research remains single-queue, account-wide for first pass.
- Mock-up ideas implying multiple concurrent research items are out of scope for first pass.
- Canceling research should use backend semantics:
  - full refund of spent meta-matter
  - full refund of spent colony resources

Out of scope for first pass:

- extra queue slots from research
- reduced cancellation penalties/refunds as research effects

## Effects And Unlocks

- Ignore mock-up effect strings that exist only for visual prototyping.
- Favor backend/shared typed gameplay effects as the long-term model.
- Any effect that survives into the integrated tree should be representable as a typed effect in shared game logic.

Implication:

- The tree content should be re-authored as actual game data, not copied from display strings.
- Unlocks, modifiers, and progression hooks should be explicitly defined in shared logic rather than inferred from UI copy.

## Layout Direction

- The radial tree is the target UI.
- The radial mock-up's visual presentation is the useful part; its node roster is not canonical.
- The final roster can be built from existing backend nodes plus additional stand-in nodes.
- The research data model needs to support the radial layout directly enough that laying out nodes, assigning dependencies, and authoring costs stays manageable.

Design requirement:

- Research definitions should include layout-oriented metadata suitable for the radial tree.
- Layout metadata should be authored in a way that is easy to maintain when adding or rearranging nodes.
- Cross-links in the radial tree should be gameplay-relevant prerequisites, not decorative-only edges.

Possible authoring shape:

- Use nested authored objects with the five branches at the top level.
- Each branch can contain tiers.
- Each tier can contain a list of nodes.
- This could make laying out nodes, assigning dependencies, assigning costs, and scanning branch progression easier than a single flat array.
- The full definition should stay in one place. Avoid splitting node definitions, branch tier gates, effects, costs, and layout metadata across separate source files unless there is a strong technical reason.

Current implementation:

- The first-pass authored shape is nested by branch and tier in shared game logic.
- Flat registries are generated from that nested definition for compatibility with existing backend/gameplay helpers.

## Content Authority

For first-pass integration:

- Product shape and branch count: favor mock-up direction.
- Queue and cancellation semantics: favor backend direction.
- Visibility logic: favor backend direction, with added support for a `researching` presentation state.
- Final node content/effects: re-author deliberately; favor existing backend nodes/effects where useful, add stand-ins where needed, and do not blindly trust mock copy.
- Final layout: favor the radial mock-up, but rebuild it around canonical shared ids and data.

## Immediate Consequences

The current codebase has three incompatible research representations:

- backend/shared gameplay tree
- `mockup-data.ts`
- `radial-tree-data.ts`

The integrated research screen should use the shared authored definition set plus narrowly scoped derived UI helpers. Prototype-only mock files can remain as archival references until the old mock routes are removed.

## Tier Unlock Concepts

Research tiers may have branch-specific unlock requirements that ask the player to engage with the relevant game loop before deeper technologies become available.

Exploratory examples:

- Military tier unlocks could require completing a certain number of contracts.
- Industry tier unlocks could require building the player's first level 30 building.

Design intent:

- Tier unlocks should make branches feel tied to gameplay accomplishments rather than only research facility level.
- Tier unlocks may be branch-specific.
- Tier unlocks should be authored explicitly and exposed clearly in the UI.
- Tier unlocks are branch-wide.
- Tier unlocks are account-wide.
- Tier unlocks should vary meaningfully across branches and even between tiers inside the same branch.
- To access a node, the player needs both the branch-wide tier unlock and the node's prerequisite research node requirements.
- Tier unlocks gate both visibility and startability.
- Prerequisite node requirements also prevent visibility.
- Tier unlocks should not be bespoke systems per tier.
- Tier unlocks should use one generic account-wide unlock-rule system with a shared rule vocabulary, so tiers can declare different requirements without requiring custom evaluator code for each tier.
- This is still exploratory and needs product tuning before the authored tier gates are considered final.

## Outstanding Follow-Ups

These still need product decisions before the research content should be treated as final:

- Exact five-branch node roster for first pass.
- Which mock-only nodes survive, which backend nodes survive, and which are replaced.
- Whether the nested branch/tier authoring shape should remain the final structure or be adjusted after content review.
- Whether generated radial positions from lane/tier metadata are sufficient or whether specific nodes need direct position overrides.
- Whether radial edges are derived entirely from prerequisites or whether the authoring model also needs separate visual layout hints.
- What branch-specific tier unlock requirements should exist after content review.
- Whether node-level requirements beyond tier unlocks and prerequisite nodes should affect visibility, startability, or only disabled-state requirements.
