import { expect, test } from "bun:test";

import {
	AUTHORED_RESEARCH_BRANCHES,
	buildResearchModifierSnapshot,
	canResearchNodeStart,
	DEFAULT_RESEARCH_TREE,
	getResearchVisibility,
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
		DEFAULT_RESEARCH_TREE.find((node) => node.id === "parallelInquiry")
			?.requiredResearchNetworkSize,
	).toBe(3);
	expect(
		DEFAULT_RESEARCH_TREE.find((node) => node.id === "federatedDatabanks")
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
			researchKey: "parallelInquiry",
			tierUnlockContext: { researchNetworkSize: 1 },
		}),
	).toBe(false);

	expect(
		canResearchNodeStart({
			levels: { archiveCompression: 1 },
			researchKey: "parallelInquiry",
			tierUnlockContext: {
				metaMatterSpentTotal: 50,
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
	expect(getResearchVisibility({ levels: {}, researchKey: "parallelInquiry" })).toBe("hidden");
	expect(
		getResearchVisibility({
			levels: { archiveCompression: 1 },
			researchKey: "parallelInquiry",
			tierUnlockContext: {
				metaMatterSpentTotal: 50,
				researchNetworkSize: 3,
			},
		}),
	).toBe("silhouette");
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
