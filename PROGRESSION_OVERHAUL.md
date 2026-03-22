# Progression Overhaul Spec

## Scope

This spec defines the systems needed to turn rank into the backbone of early-game onboarding. It intentionally avoids prescribing the exact rank-by-rank progression timeline. The goal is to support a guided experience from `Rank 0` to `Rank 5`, with the game substantially opened up by `Rank 5` and second-colony colonization available by then.

## Goals

- Replace the current mostly-passive rank system with a progression framework that controls feature exposure.
- Prevent new players from seeing every major game system immediately.
- Introduce a quest-driven onboarding flow as the primary early XP source.
- Make rank progression visible, rewarding, and legible in the UI.
- Redesign new-player initialization so starting state matches the guided progression model.
- Preserve room for future content and additional rank-gated systems after the initial rollout.

## Non-Goals

- This spec does not define the exact unlock order by rank.
- This spec does not define exact XP values, quest counts, or reward amounts.
- This spec does not redesign every midgame or endgame system.
- This spec does not require immediate implementation of all future rank-gated mechanics.

## Core Design Principles

- Early rank is guided progression, not emergent grind.
- Rank controls system exposure, not just numeric bonuses.
- New systems should appear with explanation and context.
- The UI should distinguish between hidden, locked, and unlocked systems.
- Early XP should primarily come from curated quests, not passive colony activity.
- By the end of the onboarding arc, the player should understand the core loop and have access to the broader game.

## System Overview

The redesign has four major pillars:

- New player initialization overhaul
- Quest system
- Rank system redesign
- Rank/UI onboarding layer

## 1. New Player Initialization Overhaul

New players should no longer start in a state that assumes full-system access. Initial account setup must produce a world state, colony state, and UI state aligned with a guided experience.

### Requirements

- Players start at `Rank 0`.
- Starting colony state must support a narrow initial gameplay slice.
- Systems not yet introduced by progression should either be absent from state, ignored by UI, or safely dormant.
- Initial resource/infrastructure values should be tuned for a tutorialized start rather than a sandbox start.
- The starting colony should be generated with progression-aware defaults.
- Any scheduled or reactive systems that depend on later unlocks must not create pressure before the player has been introduced to them.

### Initialization Concerns

- Starter colony composition
- Starting buildings/facilities/queues
- Starting fleet and ship availability
- Starting contract availability
- NPC raids must not begin before the defending player reaches `Rank 5`. This follows the Colony raid design clarification from 2026-03-11.
- Colonization eligibility
- Notification defaults
- Tutorial/quest bootstrap state
- Rank and XP initialization

### Implementation Expectation

- New-player bootstrap should become an explicit progression-aware setup path, not just a generic colony creation path.
- Existing players may need a migration or fallback compatibility path, but this spec is primarily about new accounts.

## 2. Quest System

Quests are the primary early progression driver. They are used to teach systems, create structure, and award rank XP. The quest system should support both the tutorial campaign and future content expansion.

### Quest Types

- Main quests
- Intro/system quests
- Optional side quests
- Repeatable quests for later progression, if needed

### Main Quest Requirements

- Main quests define the critical onboarding path.
- Completing main quests is the primary way to earn early rank XP.
- Main quests should be sequential or chapter-based.
- Main quests should be able to unlock systems, UI surfaces, and tutorials.

### Intro/System Quest Requirements

- A newly unlocked system should be paired with one or more short quests.
- These quests should validate first use of the system.
- These quests should serve as the bridge between unlock and player mastery.

### Optional Quest Requirements

- Optional quests provide extra resources, credits, or flavor.
- Optional quests should not block main progression.
- They should remain useful for reinforcement without becoming required grind.

### Quest Data Model Needs

- Quest definitions
- Quest categories/types
- Prerequisites
- Objective definitions
- Progress tracking
- Completion state
- Reward definitions
- Optional narrative/tutorial copy payloads
- System unlock hooks

### Objective Model Should Support

- Visit/open a screen
- Upgrade/build a target object
- Queue or complete an action
- Wait for or respond to a world event
- Survive or complete an encounter
- Launch or resolve an operation
- Claim a reward
- Manual acknowledgment when needed

### Quest Rewards Should Support

- Rank XP
- Credits
- Resources
- Itemized unlocks
- UI/tutorial triggers
- Feature exposure flags
- Cosmetic rewards later if desired

### Quest UX Requirements

- Persistent quest tracker
- Main quest prominence
- Progress state that survives refresh/navigation
- Clear completion feedback
- Clear reward display
- "Next step" messaging
- Dedicated quest log or panel
- Integration with rank-up flow when quest completion causes a rank increase

## 3. Rank System Redesign

Rank should become the progression authority for early-game feature exposure. It is no longer just an accumulation number tied loosely to contracts.

### Functional Requirements

- Players start at `Rank 0`.
- Rank must support a bounded early progression arc through at least `Rank 5`.
- Rank must be capable of unlocking mechanics, screens, and world pressures.
- Rank XP must be primarily quest-driven in the onboarding phase.
- Rank penalties should be avoided while rank gates major access.
- Rank should support future extension beyond the guided opening.

### Rank Data Requirements

- Current rank
- Current XP
- XP requirement metadata
- Unlock metadata for current/next rank
- Rank-up history or event surface if needed for UX
- Progression state for future display logic

### Unlock Model

Rank unlocks should be first-class data, not scattered conditionals. The system should support unlocking:

- UI tabs
- Facilities
- Mission types
- World systems
- Notifications
- Social systems
- Colonization permissions
- Tutorial flows
- Mechanical caps such as colony cap

The unlock model should support at least three states:

- Hidden: player should not see the feature yet
- Teased/locked: player can see it exists but cannot use it
- Unlocked: player has access

### Rank-Coupled Game Rules That Likely Need Redesign

- Colony cap
- Second-colony availability by the end of the onboarding arc
- Contract visibility rules
- Concurrent contract limit, if no longer rank-based
- Raid participation/eligibility
- Shipyard/fleet access should not be hard-gated by player rank in this phase. Default facility definitions are still placeholders, so keep the existing shipyard-level-only unlock checks in place until non-shipyard facilities exist.
- Social feature access remains rank-gated separately; the shipyard clarification above does not change those social unlock decisions.
- Defense system visibility and eligibility

### Second-Colony Requirement

- By `Rank 5`, the player must be able to colonize a second planet.
- This likely implies both a colonization unlock and a colony cap increase by or before that point.
- The system must prevent invalid states and should enforce colony cap at action time, not retroactively.

### Progression Extensibility

- The rank system should support future capped progression or later expansion.
- Unlock definitions should be content-driven enough to add more gated systems later without rewriting the core framework.

## 4. Rank UI and Onboarding Layer

Rank currently lacks presence. The new UI should make rank visible before, during, and after unlock moments.

### Rank Surface Requirements

- Rank display should be upgraded from static label to progression widget.
- The header should show current rank and progress toward next rank.
- The player should be able to inspect current benefits and upcoming unlocks.
- Rank should feel clickable and meaningful, not decorative.

### Rank-Up UX Requirements

- Rank-up should produce an unmistakable moment.
- The header or rank badge should pulse/glow until acknowledged.
- A rank-up modal or panel should show:
  - new rank
  - what was earned
  - what was unlocked
  - what this means in practice
  - what comes next
- Rank-up should support a short celebratory animation without becoming intrusive.

### Unlock Reveal Requirements

- Newly unlocked systems should feel introduced, not merely enabled.
- Unlocks should be paired with tutorial copy, quest prompts, or guided next steps.
- If a major tab becomes available, the UI should call attention to it.
- The first unlock interaction should be narrative and instructional where appropriate.

### Current/Next Unlock Visibility

- The player should always be able to inspect:
  - what rank currently grants
  - what next rank unlocks
  - whether any unlock is waiting to be acknowledged
- This should be accessible from the header and/or a dedicated progression panel.

### Locked Feature UX

- Some future systems may be best hidden completely.
- Others may benefit from being visible but locked.
- The UI framework should support both on a per-feature basis.
- Locked surfaces should explain what unlocks them, without overwhelming the player with future complexity.

## Feature Gating Framework

A general feature gating layer is needed so progression logic is not duplicated ad hoc across backend and UI.

The gating framework should answer:

- Is this feature unlocked for this player?
- Should this feature be hidden, shown locked, or shown unlocked?
- Is the player eligible to trigger this system?
- Should this world event/system be active for this player yet?

This framework should be usable by:

- frontend navigation and tab rendering
- backend validation for mutations/actions
- world/system schedulers
- notification emission
- quest availability
- tutorial triggers

Examples of systems this should gate:

- raids
- defenses
- shipyard
- fleet management
- contracts
- colonization
- social/clan systems
- advanced notifications
- future research or diplomacy systems

## Tutorial / Guided Explanation Layer

Feature unlocks should be teachable. The quest system handles progression logic; a tutorial layer handles explanation and first-use guidance.

### Requirements

- Trigger tutorials when a system first unlocks
- Support dismissible explainer content
- Support small guided flows attached to newly visible screens
- Avoid repeating completed tutorials
- Tie tutorial completion to quest progress where useful

This layer does not need to be a full cinematic tutorial system. It can begin as:

- modal/panel explainer
- highlighted UI pointer
- guided quest step
- contextual hint on first visit

## Rewards Framework

Rank and quests need a general reward framework to avoid bespoke handling every time.

Rewards should support:

- rank XP
- credits
- resources
- colony cap increase
- system unlock
- quest unlock
- tutorial trigger
- UI acknowledgment trigger
- future cosmetic or social rewards

The reward framework should be declarative enough that quests and ranks can use the same primitives.

## Notifications and Discoverability

As systems are staged, notifications should also respect progression.

### Requirements

- Systems not yet unlocked should not generate confusing notifications.
- Major unlocks should generate first-class progression notifications.
- Quest completion and rank-up should have distinct presentation.
- Newly available systems should be discoverable from their notifications or rank-up surfaces.

## Migration / Compatibility Considerations

This redesign touches foundational assumptions. Existing accounts may not fit the new model cleanly.

### Compatibility Concerns

- Existing players already above the intended onboarding arc
- Existing player colonies/fleet/contracts
- Existing notifications and progression state
- Existing raid eligibility
- Existing UI assumptions about always-visible tabs

The implementation should define a compatibility strategy such as:

- grandfather existing accounts into "fully unlocked"
- map existing rank to new progression state
- create a one-time migration for progression rows and unlock states
- ensure old accounts do not get trapped in partial onboarding

This can be handled separately from the new-player flow, but it must be accounted for.

## Data / Backend Capabilities Needed

The backend likely needs dedicated persistence for:

- quest definitions and/or runtime quest state
- player progression/unlock state
- acknowledged rank-up state
- tutorial completion state
- feature unlock visibility state, if not derivable purely from rank
- future compatibility versioning for onboarding schema

The current `playerProgression` shape is too thin for the new UX and progression model. It should evolve to support:

- rank metadata for display
- current unlock set or derivable progression state
- pending rank-up acknowledgment state
- enough information for the UI to render "earned now / next unlock"

## Frontend Capabilities Needed

The frontend needs:

- progression-aware header rank widget
- rank-up modal/panel
- quest tracker and quest log
- gated navigation rendering
- locked/teased feature states
- tutorial/explainer surfaces
- first-unlock attention patterns
- a stable place to view current and upcoming unlocks

## Success Criteria

The redesign is successful if:

- New players are not exposed to all major systems immediately.
- Early rank progression is primarily driven by quests.
- Unlocking a new system feels deliberate and noticeable.
- The player can always understand what rank does for them.
- By the end of the onboarding arc, the player has access to the broader game and can colonize a second planet.
- The architecture leaves room for future rank-gated systems without another foundational rewrite.

## Open Design Decisions

These should remain open for later balancing:

- Exact unlock order by rank
- Exact XP curve
- Exact quest content and count
- Which features should be hidden vs shown locked
- Which future systems should also become rank-gated
- Whether rank becomes capped short-term or indefinitely extensible
- How aggressively existing players are migrated into the new model

## Recommended Implementation Phasing

1. Build progression/gating foundations.
2. Overhaul new-player initialization.
3. Add quest runtime and early quest UX.
4. Redesign rank data model and header/modal UI.
5. Gate existing systems behind progression states.
6. Add tutorials/explainers for newly unlocked systems.
7. Tune progression content and pacing afterward.
