// FNV-1a 32-bit hash to map string seeds to deterministic uint32 values.
export function hashSeed(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export function createPrng(seed: string) {
	let state = hashSeed(seed) || 0x6d2b79f5;

	const next = () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	return {
		nextFloat: next,
		nextInRange(min: number, max: number) {
			return min + (max - min) * next();
		},
		nextInt(minInclusive: number, maxInclusive: number) {
			if (maxInclusive < minInclusive) {
				throw new Error("maxInclusive must be >= minInclusive");
			}
			const span = maxInclusive - minInclusive + 1;
			return minInclusive + Math.floor(next() * span);
		},
	};
}
