import { expect, test } from "bun:test";

import {
	AUTHORED_RESEARCH_BRANCHES,
	buildResearchModifierSnapshot,
	canResearchNodeStart,
	DEFAULT_RESEARCH_TREE,
	getResearchVisibility,
	getResearchTier,
	isDefenseUnlocked,
	isShipUnlocked,
	rollMetaMatterBundle,
} from "..";

test("tier-three tree authors 3/5/7 nodes and hides planned nodes", () => {
	for (const branch of AUTHORED_RESEARCH_BRANCHES) {
		expect(branch.tiers.find((tier) => tier.tier === 1)?.nodes.length).toBe(3);
		expect(branch.tiers.find((tier) => tier.tier === 2)?.nodes.length).toBe(5);
		expect(branch.tiers.find((tier) => tier.tier === 3)?.nodes.length).toBe(7);
	}
	expect(DEFAULT_RESEARCH_TREE.some((node) => node.id === "thermalExchangePlants")).toBe(false);
	expect(DEFAULT_RESEARCH_TREE.some((node) => node.id === "terraformerFacilityDesign")).toBe(false);
	expect(
		DEFAULT_RESEARCH_TREE.find((node) => node.id === "distributedRobotics")?.prerequisites,
	).toEqual(["modularAssemblyStandards", "storageCompressionLattices"]);
	expect(
		DEFAULT_RESEARCH_TREE.find((node) => node.id === "archiveCompression")
			?.requiredResearchNetworkSize,
	).toBe(1);
	expect(
		DEFAULT_RESEARCH_TREE.find((node) => node.id === "contractAnalytics")
			?.requiredResearchNetworkSize,
	).toBe(3);
	expect(
		DEFAULT_RESEARCH_TREE.find((node) => node.id === "advancedStrikeCraft")
			?.requiredResearchNetworkSize,
	).toBe(5);
});

test("research branch dither colors are shader-normalized", () => {
	for (const branch of AUTHORED_RESEARCH_BRANCHES) {
		for (const channel of branch.ditherWaveColor) {
			expect(channel).toBeGreaterThanOrEqual(0);
			expect(channel).toBeLessThanOrEqual(1);
		}
	}
});

test("research effect stacking multiplies modifiers and adds cap bonuses", () => {
	const snapshot = buildResearchModifierSnapshot({
		archiveCompression: 2,
		automatedSmelting: 3,
		distributedRobotics: 1,
	});

	expect(snapshot.researchDurationMultiplier).toBeCloseTo(0.94 * 0.94, 5);
	expect(snapshot.resourceProductionMultipliers.alloy).toBeCloseTo(1.06 * 1.06 * 1.06, 5);
	expect(snapshot.buildingMaxLevelBonuses.alloyMineLevel).toBe(5);
	expect(snapshot.facilityMaxLevelBonuses.robotics_hub).toBe(2);
});

test("research start checks prerequisites and research network size", () => {
	expect(
		canResearchNodeStart({
			levels: {},
			researchKey: "archiveCompression",
			tierUnlockContext: { researchNetworkSize: 1 },
		}),
	).toBe(true);

	expect(
		canResearchNodeStart({
			levels: {},
			researchKey: "contractAnalytics",
			tierUnlockContext: { researchNetworkSize: 1 },
		}),
	).toBe(false);

	expect(
		canResearchNodeStart({
			levels: { stellarCartography: 1 },
			researchKey: "contractAnalytics",
			tierUnlockContext: {
				metaMatterSpentTotal: 200,
				researchNetworkSize: 3,
			},
		}),
	).toBe(true);
});

test("research visibility hides nodes until a direct prerequisite is complete", () => {
	expect(
		getResearchVisibility({
			levels: {},
			researchKey: "archiveCompression",
			tierUnlockContext: { researchNetworkSize: 1 },
		}),
	).toBe("silhouette");
	expect(getResearchVisibility({ levels: {}, researchKey: "contractAnalytics" })).toBe("hidden");
	expect(
		getResearchVisibility({
			levels: { stellarCartography: 1 },
			researchKey: "contractAnalytics",
			tierUnlockContext: {
				metaMatterSpentTotal: 200,
				researchNetworkSize: 3,
			},
		}),
	).toBe("silhouette");
});

test("research costs use progressive tier balance multipliers", () => {
	const archiveCompression = DEFAULT_RESEARCH_TREE.find((node) => node.id === "archiveCompression");
	const contractAnalytics = DEFAULT_RESEARCH_TREE.find((node) => node.id === "contractAnalytics");
	const advancedStrikeCraft = DEFAULT_RESEARCH_TREE.find(
		(node) => node.id === "advancedStrikeCraft",
	);

	expect(archiveCompression?.costs[0]).toEqual({
		metaMatter: { common: 16 },
		resources: { alloy: 225, crystal: 585, fuel: 90 },
		seconds: 1_800,
	});
	expect(contractAnalytics?.costs[0]).toEqual({
		metaMatter: { common: 96, rare: 8 },
		resources: { alloy: 1_000, crystal: 2_600, fuel: 400 },
		seconds: 10_800,
	});
	expect(advancedStrikeCraft?.costs[0]).toEqual({
		metaMatter: { rare: 60 },
		resources: { alloy: 6_250, crystal: 3_750, fuel: 2_500 },
		seconds: 36_000,
	});
});

test("scientific research spend gates scale with the new cost bands", () => {
	expect(getResearchTier({ branchKey: "scientificInfrastructure", tier: 2 })?.unlock).toEqual({
		type: "all",
		rules: [
			{ type: "researchNetworkSize", count: 3 },
			{ type: "all", rules: [{ type: "metaMatterSpentTotal", amount: 200 }] },
		],
	});
	expect(getResearchTier({ branchKey: "scientificInfrastructure", tier: 3 })?.unlock).toEqual({
		type: "all",
		rules: [
			{ type: "researchNetworkSize", count: 5 },
			{
				type: "all",
				rules: [
					{ type: "metaMatterSpentTotal", amount: 2_000 },
					{ type: "metaMatterEarnedByRarity", rarity: "rare", amount: 25 },
				],
			},
		],
	});
});

test("ship and defense unlocks require research plus facility level gates separately", () => {
	const noResearchContext = {
		facilityLevels: {
			shipyard: 10,
			defense_grid: 10,
			robotics_hub: 0,
			research_directorate: 0,
		},
		researchLevels: {},
	};
	const unlockedContext = {
		...noResearchContext,
		researchLevels: {
			advancedStrikeCraft: 1,
			shieldFieldModulation: 1,
		},
	};

	expect(isShipUnlocked("bomber", noResearchContext)).toBe(false);
	expect(isShipUnlocked("bomber", unlockedContext)).toBe(true);
	expect(isDefenseUnlocked("shieldDome", noResearchContext)).toBe(false);
	expect(isDefenseUnlocked("shieldDome", unlockedContext)).toBe(true);
});

test("meta-matter rolls are deterministic for the same seed and vary by seed", () => {
	const a = rollMetaMatterBundle({
		difficultyTier: 5,
		seed: "contract:alpha",
	});
	const b = rollMetaMatterBundle({
		difficultyTier: 5,
		seed: "contract:alpha",
	});
	const variants = [
		rollMetaMatterBundle({ difficultyTier: 5, seed: "contract:beta" }),
		rollMetaMatterBundle({ difficultyTier: 5, seed: "contract:gamma" }),
		rollMetaMatterBundle({ difficultyTier: 5, seed: "contract:delta" }),
	];

	expect(a).toEqual(b);
	expect(variants.some((variant) => JSON.stringify(variant) !== JSON.stringify(a))).toBe(true);
});
