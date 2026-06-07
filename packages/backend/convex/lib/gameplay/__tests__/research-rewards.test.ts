import { describe, expect, it } from "vitest";

import { buildAcceptedContractMetaMatterReward } from "../../../../runtime/gameplay/research";

describe("research contract rewards", () => {
	it("snapshots deterministic meta-matter bundles from accept-time inputs", () => {
		const levels = {
			surveyUplinks: 1,
		};

		const first = buildAcceptedContractMetaMatterReward({
			difficultyTier: 4,
			playerResearchLevels: levels,
			seed: "player:planet:slot:1",
		});
		const second = buildAcceptedContractMetaMatterReward({
			difficultyTier: 4,
			playerResearchLevels: levels,
			seed: "player:planet:slot:1",
		});
		const variants = [
			buildAcceptedContractMetaMatterReward({
				difficultyTier: 4,
				playerResearchLevels: levels,
				seed: "player:planet:slot:2",
			}),
			buildAcceptedContractMetaMatterReward({
				difficultyTier: 4,
				playerResearchLevels: levels,
				seed: "player:planet:slot:3",
			}),
			buildAcceptedContractMetaMatterReward({
				difficultyTier: 4,
				playerResearchLevels: levels,
				seed: "player:planet:slot:4",
			}),
		];

		expect(first).toEqual(second);
		expect(variants.some((variant) => JSON.stringify(variant) !== JSON.stringify(first))).toBe(
			true,
		);
		expect(first.rare).toBeGreaterThan(0);
	});
});
