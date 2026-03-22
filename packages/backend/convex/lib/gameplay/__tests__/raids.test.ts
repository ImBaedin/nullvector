import { describe, expect, it } from "vitest";

import { shouldSpawnNpcRaid } from "../../../../runtime/gameplay/raids";

describe("raid spawn policy", () => {
	it("blocks ambient raids while raid progression is off", () => {
		expect(
			shouldSpawnNpcRaid({
				mode: "off",
			}),
		).toBe(false);
	});

	it("allows the scripted tutorial raid even before ambient raids unlock", () => {
		expect(
			shouldSpawnNpcRaid({
				mode: "off",
				spawnReason: "tutorialRank2",
			}),
		).toBe(true);
		expect(
			shouldSpawnNpcRaid({
				mode: "tutorialOnly",
				spawnReason: "tutorialRank2",
			}),
		).toBe(true);
	});

	it("allows ambient raids once full raid progression unlocks", () => {
		expect(
			shouldSpawnNpcRaid({
				mode: "full",
			}),
		).toBe(true);
	});
});
