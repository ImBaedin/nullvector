import type { MetaMatterRarity } from "@nullvector/game-logic";

export const META_MATTER_ICON_SRC: Record<MetaMatterRarity, string> = {
	common: "/game-icons/meta-matter/meta-matter-common.png",
	rare: "/game-icons/meta-matter/meta-matter-rare.png",
	mythic: "/game-icons/meta-matter/meta-matter-mythic.png",
};

export const META_MATTER_LABELS: Record<MetaMatterRarity, string> = {
	common: "Common",
	rare: "Rare",
	mythic: "Mythic",
};
