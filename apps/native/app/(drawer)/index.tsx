import { api } from "@nullvector/backend/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { Button, Chip, Separator, Spinner, Surface, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";

export default function Home() {
	const healthCheck = useQuery(api.healthCheck.get);
	const { isAuthenticated } = useConvexAuth();
	const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");
	const successColor = useThemeColor("success");
	const dangerColor = useThemeColor("danger");

	const isConnected = healthCheck === "OK";
	const isLoading = healthCheck === undefined;

	return (
		<Container className="px-4 pb-4">
			<View className="mb-5 py-6">
				<Text className="text-3xl font-semibold tracking-tight text-foreground">
					Better T Stack
				</Text>
				<Text className="mt-1 text-sm text-muted">Full-stack TypeScript starter</Text>
			</View>

			{user ? (
				<Surface variant="secondary" className="mb-4 rounded-xl p-4">
					<View className="flex-row items-center justify-between">
						<View className="flex-1">
							<Text className="font-medium text-foreground">{user.name}</Text>
							<Text className="mt-0.5 text-xs text-muted">{user.email}</Text>
						</View>
						<Button
							variant="danger"
							size="sm"
							onPress={() => {
								authClient.signOut();
							}}
						>
							Sign Out
						</Button>
					</View>
				</Surface>
			) : null}
			<Surface variant="secondary" className="rounded-xl p-4">
				<Text className="mb-2 font-medium text-foreground">API Status</Text>
				<View className="flex-row items-center gap-2">
					<View
						className={`
        size-2  rounded-full
        ${healthCheck === "OK" ? "bg-success" : `bg-danger`}
      `}
					/>
					<Text className="text-xs text-muted">
						{healthCheck === undefined
							? "Checking..."
							: healthCheck === "OK"
								? "Connected to API"
								: "API Disconnected"}
					</Text>
				</View>
			</Surface>
			{!user && (
				<View className="mt-5 gap-4">
					<SignIn />
					<SignUp />
				</View>
			)}
		</Container>
	);
}
