import { expect, test } from "bun:test";

import {
	COMBAT_MISSION_TYPE_KEYS,
	generateContractSnapshot,
	getConcurrentContractLimit,
	getVisibleContractSlotCount,
	MISSION_TEMPLATES,
	simulateCombat,
} from "../index";

test("visible contract slots scale every five ranks", () => {
	expect(getVisibleContractSlotCount(1)).toBe(2);
	expect(getVisibleContractSlotCount(5)).toBe(2);
	expect(getVisibleContractSlotCount(6)).toBe(3);
	expect(getVisibleContractSlotCount(11)).toBe(4);
});

test("concurrent contract limit scales every five ranks", () => {
	expect(getConcurrentContractLimit(1)).toBe(1);
	expect(getConcurrentContractLimit(5)).toBe(1);
	expect(getConcurrentContractLimit(6)).toBe(2);
	expect(getConcurrentContractLimit(11)).toBe(3);
});

test("contract snapshot generation is deterministic for the same seed", () => {
	const first = generateContractSnapshot({
		difficultyTier: 2,
		planetControlMax: 1_800,
		playerRank: 6,
		seed: "planet-seed",
		slot: 1,
	});
	const second = generateContractSnapshot({
		difficultyTier: 2,
		planetControlMax: 1_800,
		playerRank: 6,
		seed: "planet-seed",
		slot: 1,
	});

	expect(second).toEqual(first);
});

test("starter mission templates are resource-first with light control pressure", () => {
	const starterTemplates = COMBAT_MISSION_TYPE_KEYS.map((key) => MISSION_TEMPLATES[key]).filter(
		(template) => template.minRank === 1,
	);

	expect(starterTemplates.length).toBeGreaterThanOrEqual(3);

	for (const template of starterTemplates) {
		const resourceTotal =
			template.baseResourceReward.alloy +
			template.baseResourceReward.crystal +
			template.baseResourceReward.fuel;

		expect(template.baseCredits).toBeLessThanOrEqual(20);
		expect(template.baseControlReduction).toBeLessThanOrEqual(24);
		expect(resourceTotal).toBeGreaterThanOrEqual(600);
		expect(template.combatBudgetMultiplier).toBeLessThanOrEqual(0.34);
	}
});

test("contract generation uses stronger base resource rewards", () => {
	const starterContracts = Array.from({ length: 12 }, (_, slot) =>
		generateContractSnapshot({
			difficultyTier: 1,
			planetControlMax: 1_800,
			playerRank: 1,
			seed: "starter-planet",
			slot,
		}),
	);
	const starterRewardTotals = starterContracts.map(
		(snapshot) =>
			snapshot.rewardResources.alloy +
			snapshot.rewardResources.crystal +
			snapshot.rewardResources.fuel,
	);

	expect(Math.min(...starterRewardTotals)).toBeGreaterThanOrEqual(880);
	expect(Math.max(...starterRewardTotals)).toBeGreaterThanOrEqual(1_700);

	const advancedContract = Array.from({ length: 40 }, (_, slot) =>
		generateContractSnapshot({
			difficultyTier: 1,
			planetControlMax: 1_800,
			playerRank: 10,
			seed: "advanced-planet",
			slot,
		}),
	).find((snapshot) => snapshot.requiredRank >= 10);

	expect(advancedContract).toBeDefined();

	const advancedRewardTotal =
		(advancedContract?.rewardResources.alloy ?? 0) +
		(advancedContract?.rewardResources.crystal ?? 0) +
		(advancedContract?.rewardResources.fuel ?? 0);

	expect(advancedRewardTotal).toBeGreaterThanOrEqual(1_320);

	const scaledStarterContract = generateContractSnapshot({
		difficultyTier: 2,
		planetControlMax: 1_800,
		playerRank: 1,
		seed: "starter-planet",
		slot: 0,
	});
	const scaledStarterRewardTotal =
		scaledStarterContract.rewardResources.alloy +
		scaledStarterContract.rewardResources.crystal +
		scaledStarterContract.rewardResources.fuel;

	expect(scaledStarterRewardTotal).toBeGreaterThan(starterRewardTotals[0] ?? 0);
});

test("rank 1 contract generation avoids capital-ship spikes and big credit payouts", () => {
	for (let slot = 0; slot < 12; slot += 1) {
		const snapshot = generateContractSnapshot({
			difficultyTier: 1,
			planetControlMax: 1_800,
			playerRank: 1,
			seed: "starter-planet",
			slot,
		});

		expect(snapshot.requiredRank).toBe(1);
		expect(snapshot.rewardCredits).toBeLessThanOrEqual(20);
		expect(snapshot.controlReduction).toBeLessThanOrEqual(24);
		expect(snapshot.enemyFleet.cruiser).toBe(0);
		expect(snapshot.enemyFleet.bomber).toBe(0);
	}
});

test("deterministic combat produces stable success and survivors", () => {
	const result = simulateCombat({
		attacker: {
			ships: {
				interceptor: 18,
				frigate: 6,
				cruiser: 2,
			},
			targetPriority: ["cruiser", "frigate", "interceptor", "gaussCannon", "laserTurret"],
		},
		defender: {
			ships: {
				interceptor: 10,
				frigate: 4,
			},
			defenses: {
				missileBattery: 5,
				laserTurret: 3,
			},
			targetPriority: ["cruiser", "frigate", "interceptor"],
		},
	});

	expect(result.roundsFought).toBeGreaterThan(0);
	expect(result.combatLogSummary.length).toBe(result.roundsFought);
	expect(result.attackerRemaining.interceptor).toBeGreaterThanOrEqual(0);
	expect(result.success).toBe(true);
});

test("combat stalemates fail when enemies remain after round six", () => {
	const result = simulateCombat({
		attacker: {
			ships: {
				smallCargo: 1,
			},
			targetPriority: ["shieldDome", "gaussCannon"],
		},
		defender: {
			defenses: {
				shieldDome: 1,
			},
			targetPriority: ["smallCargo"],
		},
		maxRounds: 6,
	});

	expect(result.success).toBe(false);
	expect(result.roundsFought).toBe(6);
	expect(result.defenderDefenseRemaining.shieldDome).toBeGreaterThan(0);
});
