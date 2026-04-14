# Research Tree Tier 1-3 First Pass

Date: 2026-04-12

This is a content planning draft for expanding the research tree by two nodes per tier. The target shape for tiers 1-3 is now 3, 5, and 7 nodes per branch, across the five canonical branches:

- `appliedIndustry`
- `militarySystems`
- `scientificInfrastructure`
- `expansionLogistics`
- `colonySpecialization`

This is not a cost pass. The goal here is to pin down first-pass node names, dependencies, rough radial positions, and exact mechanical targets before translating the tree into `packages/game-logic/src/research.ts`.

## Authoring Assumptions

- Use camelCase ids and branch keys only.
- Keep research account-wide and single-active-item for the first pass.
- Use the existing radial layout vocabulary for planning: `outerLeft`, `bridgeLeft`, `innerLeft`, `innerRight`, `bridgeRight`, `outerRight`, and `axis`.
- Position values below are `layout.lane` plus node shape, not final x/y coordinates.
- The 3/5/7 tier shape means the polar layout config probably needs a follow-up tuning pass. The current layout can chunk overflow rows, but this should be treated as the intentional first-pass density.
- Passive multi-level nodes should usually have three levels. Their final level can add a rule unlock, but the current typed effect model may need either per-level effects or a companion unlock node to represent that cleanly.
- Raw "while online" production is intentionally converted into an active-command window. A pure online bonus encourages leaving a browser open and is likely to create bad player behavior.
- Travel-speed bonuses are scoped by route class. They should not multiply every fleet operation indiscriminately.
- Distance-based transport gain is own-colony-only for V1. Cross-player resource minting should wait until trade abuse rules exist.
- Research tier access is account-wide by research site count: tier 1 requires 1 built Research Directorate, tier 2 requires 3 built Research Directorates across owned colonies, and tier 3 requires 5 built Research Directorates across owned colonies. The Research Directorate is a one-time facility per colony, not a multi-level facility.

## Branch Tier Gates


| Branch                     | Tier 1 Gate                       | Tier 2 Gate (also requires 3 research sites)                             | Tier 3 Gate (also requires 5 research sites)                                                        |
| -------------------------- | ----------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `appliedIndustry`          | 1 site      | Reach any resource production building level 20 and any storage level 12 | Reach a combined 100 levels across resource production and storage buildings on one colony          |
| `militarySystems`          | 1 site      | Complete 15 contracts and successfully defend against 15 raids           | Complete 40 contracts, win 5 rank-3+ contracts, and own 500 combat ships                            |
| `scientificInfrastructure` | 1 site      | Spend a total of 50 meta-matter                                          | Spend a total of 250 meta-matter and earn 25 rare meta-matter                                      |
| `expansionLogistics`       | 1 site      | Found a colony in another system                                         | Found a colony in another sector                                                                    |
| `colonySpecialization`     | 1 site      | Found 2 colonies and reach any facility level 12                         | Found 4 colonies and reach combined facility level 60 on a single colony                            |


Several of these tier gates are intentionally more specific than the current generic tier-unlock vocabulary. The current evaluator would need additional rule types for resource-building levels, storage-building levels, total meta-matter spent, rare meta-matter earned, rank-specific contract wins, cross-system/cross-sector colony location, and combined facility level on one colony.

## Applied Industry

Focus: resource output, storage, power, construction pacing, and empire-scale production networks.


| Tier | Position             | Id                           | Levels | Requires                                                                       | Exact effect                                                                                                                                                                                                                     |
| ---- | -------------------- | ---------------------------- | ------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `innerLeft` circle   | `automatedSmelting`          | 3      | None                                                                           | Alloy production +6% per level. Level 3 also unlocks the future `alloyCatalyzer` production-boost building.                                                                                                                      |
| 1    | `innerRight` circle  | `crystalLatticeRefinement`   | 3      | None                                                                           | Crystal production +6% per level. Level 3 also unlocks the future `crystalFocusingArray` production-boost building.                                                                                                              |
| 1    | `bridgeLeft` circle  | `refineryFlowControl`        | 3      | None                                                                           | Fuel production +6% per level. Level 3 also unlocks the future `volatileCrackingStack` production-boost building.                                                                                                                |
| 2    | `bridgeRight` square | `gridLoadBalancing`          | 2      | `refineryFlowControl`                                                          | Mine and refinery energy demand -12% per level. Level 2 unlocks the `thermalExchangePlants` dependency chain.                                                                                                                    |
| 2    | `outerLeft` circle   | `modularAssemblyStandards`   | 3      | `automatedSmelting`, `crystalLatticeRefinement`                                | Building upgrade duration -8% per level. Level 3 grants +1 building queue slot if queue-capacity-by-research is added.                                                                                                           |
| 2    | `innerLeft` hex      | `scarcityDrivenThroughput`   | 2      | `automatedSmelting`, `crystalLatticeRefinement`, `refineryFlowControl`         | If a non-energy resource is below 30% storage, that resource's production is +25%, linearly falling to 0% at 80% storage. Level 2 raises the full-bonus threshold to 45%.                                                        |
| 2    | `innerRight` square  | `boosterAnnexBlueprints`     | 1      | `automatedSmelting`, `crystalLatticeRefinement`, `refineryFlowControl`         | Unlocks the resource production boosting building family: `alloyCatalyzer`, `crystalFocusingArray`, and `volatileCrackingStack`. Each building should boost one local resource by +25% at meaningful energy/fuel operating cost. |
| 2    | `outerRight` circle  | `storageCompressionLattices` | 3      | `gridLoadBalancing`                                                            | Alloy, crystal, and fuel storage +15% per level. Level 3 doubles overflow reintegration rate when storage headroom exists.                                                                                                       |
| 3    | `outerLeft` square   | `distributedRobotics`        | 1      | `modularAssemblyStandards`, `boosterAnnexBlueprints`                           | Alloy mine, crystal mine, and fuel refinery max levels +5. Robotics Hub max level +2.                                                                                                                                            |
| 3    | `innerLeft` circle   | `adaptiveAssemblySchedules`  | 3      | `modularAssemblyStandards`, `gridLoadBalancing`                                | Each idle building queue slot on a colony reduces local building upgrade duration by 4% per level, capped at 12% per level. Level 3 also adds +1 building queue slot if queue-capacity-by-research is added.                     |
| 3    | `bridgeLeft` hex     | `industrialNetworkEffects`   | 3      | `scarcityDrivenThroughput`, `storageCompressionLattices`                       | Every founded colony beyond the first increases global alloy, crystal, and fuel production by +5%. Caps: +25% at level 1, +40% at level 2, +60% at level 3.                                                                      |
| 3    | `innerRight` hex     | `wasteHeatRecoveryGrid`      | 2      | `thermalExchangePlants`, `storageCompressionLattices`                          | Fuel-consuming power plants use 20% less fuel at level 1 and 35% less at level 2. At level 2, excess energy can increase local non-energy production by up to +15%.                                                              |
| 3    | `bridgeRight` hex    | `thermalExchangePlants`      | 1      | `gridLoadBalancing`, `refineryFlowControl`                                     | Unlocks the future `fuelTurbinePlant`: a fuel-consuming power plant that can cover energy deficits before production penalties apply.                                                                                            |
| 3    | `outerRight` square  | `planetaryScaleFabrication`  | 2      | `distributedRobotics`, `industrialNetworkEffects`                              | Facility upgrade duration -12% per level for `robotics_hub`, `logistics_nexus`, and `defense_grid`. Level 2 adds +1 max level to those facilities.                                                                              |
| 3    | `axis` capstone      | `industrialFoundryProtocol`  | 1      | `distributedRobotics`, `industrialNetworkEffects`, `planetaryScaleFabrication` | Each colony may choose one industrial focus: alloy, crystal, or fuel. The focused resource gains +30% local production, while the other two non-energy resources lose 10% local production.                                      |


## Military Systems

Focus: ship and defense unlocks, combat doctrine, contract throughput, and distinctive tactical rules.


| Tier | Position             | Id                            | Levels | Requires                                                             | Exact effect                                                                                                                                                                                                                           |
| ---- | -------------------- | ----------------------------- | ------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `innerLeft` hex      | `pointDefenseTheory`          | 1      | None                                                                 | Unlocks `laserTurret`.                                                                                                                                                                                                                 |
| 1    | `innerRight` hex     | `missileGuidanceSuites`       | 1      | None                                                                 | Unlocks `frigate`.                                                                                                                                                                                                                     |
| 1    | `bridgeLeft` circle  | `interceptorWolfpackDoctrine` | 3      | None                                                                 | On contracts, if 5+ interceptors are sent and interceptors are at least 50% of committed ships, interceptors gain +20% attack at level 1, +15% hull at level 2, and -20% contract dispatch fuel cost at level 3.                       |
| 2    | `bridgeRight` square | `contractTriageCommand`       | 2      | `interceptorWolfpackDoctrine`                                        | Contract dispatch fuel cost -10% per level for combat ships. Level 2 also reduces the ship-commitment safety margin shown in UI recommendations by 5%.                                                                                 |
| 2    | `outerLeft` circle   | `reactorHardenedHulls`        | 3      | `missileGuidanceSuites`                                              | Combat ship hull +8% per level. Level 3 also grants combat ship shield +5%.                                                                                                                                                            |
| 2    | `innerLeft` hex      | `shieldFieldModulation`       | 1      | `pointDefenseTheory`, `reactorHardenedHulls`                         | Unlocks `gaussCannon` and `shieldDome`. Defense build duration -8%.                                                                                                                                                                    |
| 2    | `innerRight` circle  | `targetSolutionEngines`       | 3      | `interceptorWolfpackDoctrine`                                        | Combat ship attack +6% per level. Level 3 adds +10% attack for interceptors and frigates when the enemy force contains cruiser-class or larger ships.                                                                                  |
| 2    | `outerRight` square  | `battlefieldRecoveryCrews`    | 2      | `contractTriageCommand`                                              | Successful combat contracts recover resources equal to 10% of destroyed friendly ship alloy/crystal cost at level 1 and 20% at level 2.                                                                                                |
| 3    | `outerLeft` hex      | `advancedStrikeCraft`         | 1      | `shieldFieldModulation`, `targetSolutionEngines`                     | Unlocks `cruiser` and `bomber`.                                                                                                                                                                                                        |
| 3    | `innerLeft` circle   | `munitionsThroughput`         | 3      | `reactorHardenedHulls`, `targetSolutionEngines`                      | Combat ship build duration -8% per level. Level 3 also reduces combat ship fuel launch cost by 15%.                                                                                                                                    |
| 3    | `bridgeLeft` hex     | `boardingDoctrine`            | 2      | `battlefieldRecoveryCrews`, `advancedStrikeCraft`                    | Victorious combat contracts have a 10% chance at level 1, 18% at level 2, to capture one eligible enemy ship. Level 1 can capture interceptors only; level 2 can capture interceptors or frigates. Max one captured ship per contract. |
| 3    | `innerRight` hex     | `electronicWarfareSuites`     | 2      | `targetSolutionEngines`, `shieldFieldModulation`                     | On contracts where the committed fleet meets or exceeds recommended strength, enemy attack is reduced by 8% at level 1 and 15% at level 2.                                                                                             |
| 3    | `bridgeRight` square | `taskForceDelegation`         | 1      | `contractTriageCommand`, `advancedStrikeCraft`                       | Active accepted contract limit +1 account-wide. This should stack with per-colony shipyard-derived task force limits rather than replacing them.                                                                                       |
| 3    | `outerRight` circle  | `integratedDefenseDrills`     | 3      | `shieldFieldModulation`                                              | Planetary defenses gain +7% attack and +7% hull per level. Level 3 also gives `shieldDome` +15% shield strength.                                                                                                                       |
| 3    | `axis` capstone      | `theaterCommandSystems`       | 1      | `taskForceDelegation`, `boardingDoctrine`, `integratedDefenseDrills` | Combat contracts may reserve a task force template. Reusing the template within 24 hours gives -35% dispatch fuel cost and +10% meta-matter rewards for that contract.                                                                 |


## Scientific Infrastructure

Focus: research cadence, meta-matter yield, visibility/intelligence, and cross-domain theory prerequisites.


| Tier | Position             | Id                         | Levels | Requires                                           | Exact effect                                                                                                                                                                                                               |
| ---- | -------------------- | -------------------------- | ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `innerLeft` circle   | `archiveCompression`       | 3      | None                                               | Research duration -6% per level. Level 3 reveals silhouette cards for the next locked tier in the active branch once its tier gate is met.                                                                                 |
| 1    | `innerRight` circle  | `experimentalMethodology`  | 2      | None                                               | All meta-matter rewards +5% per level. Level 2 also adds +3 percentage points to the chance that a contract awards rare meta-matter when rare rewards are eligible.                                                        |
| 1    | `bridgeLeft` hex     | `stellarCartography`       | 1      | None                                               | Unlocks route-class visibility in fleet planning and acts as the prerequisite for sector and galactic travel research.                                                                                                     |
| 2    | `bridgeRight` square | `activeCommandWindows`     | 2      | `archiveCompression`, `experimentalMethodology`    | Replaces pure online production. After a manual colony action, the acted-on colony gains +10% non-energy production for 20 minutes at level 1. Level 2 makes the window account-wide for owned colonies, still 20 minutes. |
| 2    | `outerLeft` circle   | `parallelInquiry`          | 3      | `archiveCompression`                               | Each research site beyond the first reduces research duration by an additional 2%, capped at 10% at level 1, 15% at level 2, and 20% at level 3.                                                                          |
| 2    | `innerLeft` circle   | `xenologicSampling`        | 3      | `experimentalMethodology`, `contractTriageCommand` | Rare meta-matter chance from contracts +5 percentage points per level. Level 3 also adds +1 percentage point mythic chance on rank 3+ contracts when mythic rewards are eligible.                                          |
| 2    | `innerRight` square  | `peerReviewProtocols`      | 2      | `archiveCompression`, `experimentalMethodology`    | Common meta-matter research costs -8% per level for tier 1-2 nodes. Level 2 also reduces rare meta-matter costs by 5% for tier 2 nodes.                                                                                    |
| 2    | `outerRight` hex     | `contractAnalytics`        | 2      | `stellarCartography`                               | Visible colony contract candidates +1 at level 1 and +1 more at level 2. This does not increase active accepted contract limit.                                                                                            |
| 3    | `outerLeft` square   | `federatedDatabanks`       | 1      | `parallelInquiry`, `peerReviewProtocols`           | Synchronizes built research sites into one empire-wide research network for future account-wide research rules.                                                                                                         |
| 3    | `innerLeft` square   | `directorateExchange`      | 2      | `federatedDatabanks`, `activeCommandWindows`       | Each built research site reduces research duration by 3%, capped at 12% at level 1 and 21% at level 2.                                                                                                                  |
| 3    | `bridgeLeft` circle  | `metaMatterSynthesis`      | 3      | `xenologicSampling`, `peerReviewProtocols`         | Whenever a contract awards common meta-matter, there is a 10% chance per level to add 1 rare meta-matter. Level 3 also allows converting 50 common to 1 rare once per day.                                                 |
| 3    | `innerRight` hex     | `anomalyContainment`       | 1      | `metaMatterSynthesis`, `graviticFieldTheory`       | Future anomaly or hostile-intel contracts can award mythic meta-matter. Until that system exists, rank 3+ contracts gain +2 percentage points mythic meta-matter chance.                                                   |
| 3    | `bridgeRight` hex    | `graviticFieldTheory`      | 1      | `stellarCartography`, `sectorGatePlotting`         | Unlocks galactic route modeling. Required for `galacticVectoring`.                                                                                                                                                         |
| 3    | `outerRight` square  | `predictiveResearchModels` | 2      | `contractAnalytics`, `federatedDatabanks`          | Completing a contract while research is active adds progress equal to 2% of the active node's total duration at level 1 and 4% at level 2. Cap once per active research node.                                              |
| 3    | `axis` capstone      | `crossDomainModels`        | 2      | `predictiveResearchModels`, `directorateExchange`  | Completing research in one branch gives the next research in a different branch -10% duration and -5% meta-matter cost at level 1. Level 2 improves this to -18% duration and -10% meta-matter cost.                       |


## Expansion Logistics

Focus: fleet movement, transport economy, colonization support, and distance-aware delivery rules.


| Tier | Position             | Id                           | Levels | Requires                                             | Exact effect                                                                                                                                                                             |
| ---- | -------------------- | ---------------------------- | ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `innerLeft` circle   | `cargoStandardization`       | 3      | None                                                 | Cargo capacity +12% per level for civilian ships. Level 3 also reduces cargo ship build time by 10%.                                                                                     |
| 1    | `innerRight` hex     | `interSystemCharts`          | 1      | None                                                 | Inter-system travel is 2x as fast. Applies only when origin and target are in different systems but the same sector.                                                                     |
| 1    | `bridgeLeft` circle  | `deepSpaceRefueling`         | 3      | None                                                 | Fleet fuel cost -10% per level. Level 3 also reduces colony ship launch fuel cost by 20%.                                                                                                |
| 2    | `bridgeRight` square | `transportEscrowProtocols`   | 2      | `cargoStandardization`, `deepSpaceRefueling`         | Own-colony resource transports reserve delivery storage at dispatch. Level 2 refunds 50% of launch fuel if the shipment cannot deliver because the target storage filled before arrival. |
| 2    | `outerLeft` hex      | `sectorGatePlotting`         | 1      | `interSystemCharts`, `stellarCartography`            | Inter-sector travel is 4x as fast. Applies only when origin and target are in different sectors of the same galaxy.                                                                      |
| 2    | `innerLeft` hex      | `frontierSupplyDoctrine`     | 1      | `cargoStandardization`, `deepSpaceRefueling`         | Unlocks `largeCargo` and `colonyShip`.                                                                                                                                                   |
| 2    | `innerRight` circle  | `longHaulArbitrage`          | 2      | `transportEscrowProtocols`, `frontierSupplyDoctrine` | Own-colony non-energy resource transports gain a delivery bonus equal to `distance / 1000` as a percentage. Cap is +15% at level 1 and +30% at level 2.                                  |
| 2    | `outerRight` circle  | `relayDockingStandards`      | 3      | `cargoStandardization`, `frontierSupplyDoctrine`     | Civilian ship build duration -8% per level. Level 3 also reduces transport return-leg duration by 25%.                                                                                   |
| 3    | `outerLeft` hex      | `galacticVectoring`          | 1      | `sectorGatePlotting`, `graviticFieldTheory`          | Inter-galactic travel is 16x as fast. Applies only when future worldgen supports multiple galaxies or equivalent galaxy-class route partitions.                                          |
| 3    | `innerLeft` circle   | `convoySlipstreams`          | 3      | `longHaulArbitrage`, `logisticsBackbone`             | Repeating the same own-colony transport route within 24 hours increases travel speed on that route by 12% per level, capped at 36%. The streak breaks when the route changes.            |
| 3    | `bridgeLeft` square  | `logisticsBackbone`          | 3      | `longHaulArbitrage`, `relayDockingStandards`         | Transport operations can include +1 planned delivery stop per level, max 3 extra stops. Each extra stop adds 5% fuel cost.                                                               |
| 3    | `innerRight` square  | `intermodalFreightStandards` | 2      | `transportEscrowProtocols`, `relayDockingStandards`  | Cargo ships can reserve 10% extra target storage at level 1 and 20% at level 2 for in-flight own-colony deliveries. Reserved storage expires when the mission resolves.                  |
| 3    | `bridgeRight` circle | `colonialLaunchWindows`      | 2      | `frontierSupplyDoctrine`, `relayDockingStandards`    | Colony ship build duration -20% per level. Level 2 also reduces colony ship distance fuel cost by 35%.                                                                                   |
| 3    | `outerRight` hex     | `surveyUplinks`              | 2      | `sectorGatePlotting`, `contractAnalytics`            | After a successful transport to a colony, the next contract launched from that colony within 24 hours gains +10% meta-matter rewards at level 1 and +20% at level 2.                     |
| 3    | `axis` capstone      | `stargatePrecursorSurvey`    | 1      | `galacticVectoring`, `surveyUplinks`                 | Unlocks the future fixed-route gate project. First-pass rule: the most-used own-colony route each day gets -50% travel time for 24 hours after its third successful delivery.            |


## Colony Specialization

Focus: facility identity, new colony bootstrapping, planet-shaping, and colony-specific production rules.


| Tier | Position             | Id                            | Levels | Requires                                                          | Exact effect                                                                                                                                                                                                                                                             |
| ---- | -------------------- | ----------------------------- | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `innerLeft` hex      | `defenseGridArchitecture`     | 1      | None                                                              | Keeps defense grid before shipyard in the unlock order. If facilities become research-gated, unlocks `defense_grid`; otherwise Defense Grid max level +2.                                                                                                                |
| 1    | `innerRight` hex     | `navalProductionCoordination` | 1      | None                                                              | If facilities become research-gated, unlocks `shipyard`; otherwise shipyard build queue capacity +1 once the local Shipyard reaches level 3.                                                                                                                             |
| 1    | `bridgeLeft` square  | `colonialAdministration`      | 2      | None                                                              | Colony admin overhead -5% per level. In practical terms, each level reduces global production penalty from future colony-over-cap systems by 5 percentage points if that system is added.                                                                                |
| 2    | `bridgeRight` square | `localSpecializationCharters` | 2      | `colonialAdministration`                                          | Unlocks one colony charter per colony: industrial, refinery, research, naval, or defensive. A charter gives +20% to its domain and -5% to unrelated resource production. Level 2 removes the -5% penalty.                                                                |
| 2    | `outerLeft` square   | `frontierBootstrapping`       | 3      | `colonialAdministration`                                          | New colonies start with building packages. Level 1: mines/refinery/storage level 2. Level 2: mines/refinery level 4, storage level 3, Robotics Hub level 1. Level 3: mines/refinery level 6, storage level 5, Robotics Hub level 2, Logistics Nexus level 1 if unlocked. |
| 2    | `innerLeft` hex      | `planetarySurveyMethods`      | 1      | `localSpecializationCharters`, `stellarCartography`               | Reveals planet specialization recommendations before colonization and unlocks the terraforming dependency chain.                                                                                                                                                         |
| 2    | `innerRight` circle  | `emergencyStockpileDoctrine`  | 2      | `frontierBootstrapping`, `storageCompressionLattices`             | New colonies receive protected starting resources equal to 10% of their storage at level 1 and 20% at level 2. Protected resources cannot be transported away for the first 24 hours.                                                                                    |
| 2    | `outerRight` square  | `prefecturePlanning`          | 2      | `defenseGridArchitecture`, `navalProductionCoordination`          | Facility upgrade duration -10% per level on colonies with an active specialization charter. Level 2 also reduces charter change cooldown to 12 hours.                                                                                                                    |
| 3    | `outerLeft` hex      | `terraformerFacilityDesign`   | 1      | `planetarySurveyMethods`, `federatedDatabanks`                    | Unlocks the future `terraformer` facility. First-pass facility rule: every 5 Terraformer levels reduces the strongest negative planet modifier on that colony by 25%, capped at 75%.                                                                                     |
| 3    | `innerLeft` hex      | `habitatMegastructures`       | 1      | `terraformerFacilityDesign`, `frontierBootstrapping`              | Colony cap +1 if the player already owns 4 colonies, and unlocks the future `habitatArcology` colony-support structure.                                                                                                                                                  |
| 3    | `bridgeLeft` square  | `prefabColonyKits`            | 2      | `frontierBootstrapping`, `colonialLaunchWindows`                  | New colonies founded by colony ships start with 1 queued building upgrade at level 1 and 2 queued building upgrades at level 2, using the `frontierBootstrapping` package as the starting point.                                                                         |
| 3    | `innerRight` square  | `civicLogisticsAI`            | 2      | `prefabColonyKits`, `localSpecializationCharters`                 | Chartered colonies automatically reserve 10% of incoming transport capacity for their charter's preferred resource at level 1 and 20% at level 2.                                                                                                                        |
| 3    | `bridgeRight` circle | `orbitalShipworks`            | 3      | `navalProductionCoordination`, `prefecturePlanning`               | Ship build duration -10% per level at colonies with an active naval charter. Level 3 also gives `smallCargo` and `interceptor` +10% build speed globally.                                                                                                                |
| 3    | `outerRight` circle  | `fortifiedCivicGrid`          | 3      | `defenseGridArchitecture`, `prefecturePlanning`                   | Defense build duration -10% per level at colonies with an active defensive charter. Level 3 also gives missile batteries and laser turrets +10% hull globally.                                                                                                           |
| 3    | `axis` capstone      | `sectorCapitalPlanning`       | 1      | `habitatMegastructures`, `orbitalShipworks`, `fortifiedCivicGrid` | One owned colony per sector can be designated as a sector capital. The capital gains +25% local production, and other owned colonies in that sector gain +8% local production.                                                                                           |


## Cross-Branch Links

These links are intentional gameplay dependencies, not decorative radial edges:

- `xenologicSampling` depends on `contractTriageCommand` so better meta-matter yield asks for early contract doctrine.
- `sectorGatePlotting` depends on `stellarCartography` so faster sector travel requires scientific route classification.
- `graviticFieldTheory` depends on `sectorGatePlotting` so galactic travel is not unlocked by science alone.
- `galacticVectoring` depends on `graviticFieldTheory` so the 16x travel jump waits for both logistics and science.
- `surveyUplinks` depends on `contractAnalytics` so transport-driven contract rewards require contract intelligence.
- `terraformerFacilityDesign` depends on `federatedDatabanks` so terraforming waits for a mature research network.
- `prefabColonyKits` depends on `colonialLaunchWindows` so stronger colony starts require both colony doctrine and launch logistics.
- `habitatMegastructures` depends on `terraformerFacilityDesign` so extra colony capacity waits for planet-shaping infrastructure.

## User-Idea Decisions


| Idea                                                                      | First-pass decision                                                                                                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inter-system travel 2x                                                    | Use `interSystemCharts`, tier 1 expansion.                                                                                                                      |
| Inter-sector travel 4x                                                    | Use `sectorGatePlotting`, tier 2 expansion, gated by science cartography.                                                                                       |
| Inter-galactic travel 16x                                                 | Use `galacticVectoring`, tier 3 expansion, gated by `graviticFieldTheory`; inert until multi-galaxy routing exists.                                             |
| Every additional colony increases global production by 5%                 | Use `industrialNetworkEffects`, tier 3 industry, with level-based caps to avoid runaway scaling.                                                                |
| Increase chance for meta material from contracts                          | Use `xenologicSampling` and `metaMatterSynthesis`, science.                                                                                                     |
| Unlock resource production boosting buildings                             | Use `boosterAnnexBlueprints`, industry.                                                                                                                         |
| Resources sent to another colony increased by distance/1000 as percentage | Use `longHaulArbitrage`, own-colony transports only for V1, capped at +15%/+30%.                                                                                |
| Contracts can capture enemy ships                                         | Use `boardingDoctrine`, military, capped at one eligible ship per victorious contract.                                                                          |
| While online production is increased                                      | Do not ship raw online bonus. Use `activeCommandWindows`, a timed bonus after explicit manual actions.                                                          |
| Every new colony starts with building levels                              | Use `frontierBootstrapping` and `prefabColonyKits`, colony specialization.                                                                                      |
| Low stored resources boost production                                     | Use `scarcityDrivenThroughput`, industry.                                                                                                                       |
| Building construction speed buffs                                         | Use `modularAssemblyStandards`, industry.                                                                                                                       |
| Ship production speed buffs                                               | Use `relayDockingStandards`, `colonialLaunchWindows`, and `orbitalShipworks`.                                                                                   |
| Terraformer facility                                                      | Use `terraformerFacilityDesign`, colony specialization tier 3.                                                                                                  |
| Fuel-consuming power plant                                                | Use `thermalExchangePlants`, industry tier 3.                                                                                                                   |
| New ships                                                                 | Keep `frontierSupplyDoctrine`, `missileGuidanceSuites`, and `advancedStrikeCraft` as ship unlocks.                                                              |
| New defenses                                                              | Keep `pointDefenseTheory`, `shieldFieldModulation`, and `integratedDefenseDrills` as defense path.                                                              |
| Ship/defense hull/damage/fire-rate upgrades                               | Use `reactorHardenedHulls`, `targetSolutionEngines`, and `integratedDefenseDrills`. Treat fire rate as attack until combat has rate-of-fire as a distinct stat. |
| Increase simultaneous contracts                                           | Use `taskForceDelegation`, military tier 3.                                                                                                                     |
| Reduce ship usage cost for contracts                                      | Use `contractTriageCommand` and `interceptorWolfpackDoctrine`.                                                                                                  |
| Decrease fuel cost by percentage                                          | Use `deepSpaceRefueling` for fleet fuel and `colonialLaunchWindows` for colony ships.                                                                           |
| 5+ interceptors sent on a contract boost all interceptors                 | Use `interceptorWolfpackDoctrine`, military tier 1.                                                                                                             |


## Effect Model Gaps To Plan For

Several planned nodes fit the desired product direction but are not yet covered by the current `ResearchEffect` union. Before implementation, either add typed effects for these or split them into supported companion nodes.

- Route-class travel speed and route streaks: `interSystemCharts`, `sectorGatePlotting`, `galacticVectoring`, `convoySlipstreams`, `stargatePrecursorSurvey`.
- Colony-count and sector-capital production scaling: `industrialNetworkEffects`, `sectorCapitalPlanning`.
- Storage-pressure production scaling: `scarcityDrivenThroughput`.
- Production-boost building unlock families and colony industrial focus: `boosterAnnexBlueprints`, `industrialFoundryProtocol`.
- Fuel-consuming energy building unlock and surplus-energy production conversion: `thermalExchangePlants`, `wasteHeatRecoveryGrid`.
- Idle-queue construction acceleration: `adaptiveAssemblySchedules`.
- Defense and ship stat multipliers by class and combat condition: `interceptorWolfpackDoctrine`, `reactorHardenedHulls`, `targetSolutionEngines`, `integratedDefenseDrills`, `munitionsThroughput`, `electronicWarfareSuites`.
- Contract dispatch fuel, ship-commitment modifiers, and task force templates: `contractTriageCommand`, `theaterCommandSystems`.
- Ship capture rewards: `boardingDoctrine`.
- Active accepted contract limit bonus: `taskForceDelegation`.
- Contract candidate visibility and future anomaly unlocks: `contractAnalytics`, `anomalyContainment`.
- Contract-completion research progress and cross-branch research chaining: `predictiveResearchModels`, `crossDomainModels`.
- Multi-colony research network duration scaling: `parallelInquiry` and `directorateExchange`.
- Transport storage reservation, distance delivery bonus, and preferred-resource reservations: `transportEscrowProtocols`, `longHaulArbitrage`, `intermodalFreightStandards`, `civicLogisticsAI`.
- Multi-stop transports and return-leg duration: `logisticsBackbone`, `relayDockingStandards`.
- Colony charter system: `localSpecializationCharters`, `prefecturePlanning`, `orbitalShipworks`, `fortifiedCivicGrid`.
- New colony starting packages: `frontierBootstrapping`, `emergencyStockpileDoctrine`, `prefabColonyKits`.
- Terraformer facility, planet trait mitigation, and colony-cap support: `terraformerFacilityDesign`, `habitatMegastructures`.

## Immediate Follow-Ups

- Decide whether final-level bonuses should be represented by per-level effects, separate unlock nodes, or a new `effectsByLevel` authoring shape.
- Tune the polar layout to treat 3/5/7-node tiers as intentional instead of overflow rows.
- Add or intentionally defer typed effects for the gaps above before converting this draft to game data.
- Run a balance pass on research costs and durations after the roster is accepted.
