import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["./convex/lib/gameplay/__tests__/**/*.test.ts"],
	},
});
