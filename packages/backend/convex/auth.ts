import { expo } from "@better-auth/expo";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { ConvexError, v } from "convex/values";

import type { DataModel } from "./_generated/dataModel";

import { resolveCurrentPlayer } from "../runtime/gameplay/shared";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;
const nativeAppUrl = process.env.NATIVE_APP_URL || "mybettertapp://";
const MAX_DISPLAY_NAME_LENGTH = 32;

export const authComponent = createClient<DataModel>(components.betterAuth);

function createAuth(ctx: GenericCtx<DataModel>) {
	return betterAuth({
		trustedOrigins: [
			siteUrl,
			nativeAppUrl,
			...(process.env.NODE_ENV === "development"
				? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
				: []),
		],
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		plugins: [
			expo(),
			crossDomain({ siteUrl }),
			convex({
				authConfig,
				jwksRotateOnTokenGenerationError: true,
			}),
		],
	});
}

export { createAuth };

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return await authComponent.safeGetAuthUser(ctx);
	},
});

export const getCurrentPlayerProfile = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			displayName: v.string(),
			email: v.union(v.string(), v.null()),
		}),
	),
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!authUser || !playerResult?.player) {
			return null;
		}

		return {
			displayName: playerResult.player.displayName,
			email: authUser.email ?? null,
		};
	},
});

export const updateCurrentPlayerDisplayName = mutation({
	args: {
		displayName: v.string(),
	},
	returns: v.object({
		displayName: v.string(),
	}),
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}

		const displayName = args.displayName.trim();
		if (displayName.length < 3) {
			throw new ConvexError("Display name must be at least 3 characters");
		}
		if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
			throw new ConvexError(`Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer`);
		}

		await ctx.db.patch(playerResult.player._id, {
			displayName,
		});

		return {
			displayName,
		};
	},
});
