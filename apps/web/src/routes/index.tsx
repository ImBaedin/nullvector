import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { NvButton } from "@/features/game-ui/primitives/button";
import { NvInput } from "@/features/game-ui/primitives/input";
import { authClient } from "@/lib/auth-client";
import "@/features/game-ui/theme";

export const Route = createFileRoute("/")({
	component: IndexRoute,
});

const BOOT_LINES = [
	{ tag: "BOOT", text: "NULLVECTOR COMMAND OS v4.2.1" },
	{ tag: "BOOT", text: "Loading kernel modules ............ OK" },
	{ tag: "BOOT", text: "Initializing secure channel..." },
	{ tag: "SYS", text: "Memory allocation ................. 2.4 GB" },
	{ tag: "SYS", text: "Encryption handshake .............. OK" },
	{ tag: "SYS", text: "Signal integrity .................. 98.7%" },
	{ tag: "NET", text: "Uplink established on port 7291" },
	{ tag: "NET", text: "Relay node ........................ SECTOR G2:S4" },
	{ tag: "NET", text: "Latency ........................... 12ms" },
	{ tag: "AUTH", text: "Awaiting commander credentials" },
];

const SYSTEM_LOG = [
	{ tag: "SYS", text: "Colony telemetry stream active" },
	{ tag: "SYS", text: "Fleet beacon sync ................. 4/4 nodes" },
	{ tag: "NET", text: "Bandwidth allocation .............. 840 Mbps" },
	{ tag: "SYS", text: "Threat assessment ................. LOW" },
	{ tag: "SYS", text: "Resource pipeline ................. NOMINAL" },
	{ tag: "NET", text: "Subspace relay chain .............. 3 hops" },
];

const signInSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

const signUpSchema = signInSchema
	.extend({
		name: z.string().min(2, "Name must be at least 2 characters"),
		confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
	})
	.refine((value) => value.password === value.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords do not match",
	});

type Mode = "signIn" | "signUp";

type FormValues = {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function buildFormErrors(issues: z.ZodIssue[]): FormErrors {
	const nextErrors: FormErrors = {};
	for (const issue of issues) {
		const field = issue.path[0];
		if (typeof field === "string" && !(field in nextErrors)) {
			nextErrors[field as keyof FormValues] = issue.message;
		}
	}
	return nextErrors;
}

function FormFieldError({ message }: { message?: string }) {
	if (!message) {
		return null;
	}

	return (
		<p className="nv-mono mt-1 text-[11px]" style={{ color: "var(--nv-danger)" }}>
			{message}
		</p>
	);
}

function IndexRoute() {
	const navigate = useNavigate();
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const [mode, setMode] = useState<Mode>("signIn");
	const [values, setValues] = useState<FormValues>({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [errors, setErrors] = useState<FormErrors>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isAuthLoading || !isAuthenticated) {
			return;
		}
		navigate({
			to: "/auth/complete",
			replace: true,
		});
	}, [isAuthenticated, isAuthLoading, navigate]);

	const baseDelay = BOOT_LINES.length * 100 + 200;
	const logDelay = baseDelay + 500;

	function handleChange(field: keyof FormValues, value: string) {
		setValues((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
	}

	function toggleMode() {
		setMode((current) => (current === "signIn" ? "signUp" : "signIn"));
		setErrors({});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		event.stopPropagation();

		if (mode === "signIn") {
			const parsed = signInSchema.safeParse(values);
			if (!parsed.success) {
				setErrors(buildFormErrors(parsed.error.issues));
				return;
			}

			setErrors({});
			setIsSubmitting(true);

			await authClient.signIn
				.email(
					{
						email: parsed.data.email,
						password: parsed.data.password,
					},
					{
						onSuccess: () => {
							navigate({
								to: "/auth/complete",
								replace: true,
							});
							toast.success("Sign in successful");
						},
						onError: (error) => {
							toast.error(error.error.message || error.error.statusText);
						},
					},
				)
				.catch((error) => {
					toast.error(error instanceof Error ? error.message : "Authentication failed");
				});

			setIsSubmitting(false);
			return;
		}

		const parsed = signUpSchema.safeParse(values);
		if (!parsed.success) {
			setErrors(buildFormErrors(parsed.error.issues));
			return;
		}

		setErrors({});
		setIsSubmitting(true);

		await authClient.signUp
			.email(
				{
					email: parsed.data.email,
					password: parsed.data.password,
					name: parsed.data.name,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/auth/complete",
							replace: true,
						});
						toast.success("Sign up successful");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			)
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Authentication failed");
			});

		setIsSubmitting(false);
	}

	return (
		<div className="
    game-theme-neon-dockyard relative flex h-svh min-h-0 overflow-hidden
  ">
			<div
				className="absolute inset-0 bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: "url('/login/login-bg.png')" }}
			/>
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse at 30% 50%, transparent 20%, rgba(6,11,20,0.45) 70%, rgba(6,11,20,0.8) 100%)",
				}}
			/>

			<style>{`
				@keyframes cursor-blink {
					0%, 100% { opacity: 1; }
					50% { opacity: 0; }
				}
			`}</style>

			<div
				className="pointer-events-none fixed inset-0 z-50"
				style={{
					background:
						"repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
				}}
			/>

			<div className="
     relative ml-auto flex w-full max-w-xl flex-col p-3
     lg:p-4
   ">
				<div
					className="absolute inset-0"
					style={{
						background:
							"linear-gradient(to right, transparent, rgba(6,11,20,0.7) 20%, rgba(6,11,20,0.92) 50%)",
					}}
				/>

				<div
					className="
       relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--nv-r-sm)
     "
					style={{
						border: "1px solid var(--nv-glass-stroke)",
						animation: "nv-resource-card-in 500ms var(--nv-ease-emphasis) both",
					}}
				>
					<div
						className="
        nv-mono nv-caps flex shrink-0 items-center justify-between gap-3 px-4
        py-2.5 text-xs
      "
						style={{
							backgroundColor: "rgba(17,27,47,0.9)",
							borderBottom: "1px solid var(--nv-glass-stroke)",
							color: "var(--nv-text-muted)",
						}}
					>
						<div className="flex items-center gap-3">
							<div className="flex gap-1.5">
								<div
									className="size-2 rounded-full"
									style={{ backgroundColor: "var(--nv-danger)", opacity: 0.7 }}
								/>
								<div
									className="size-2 rounded-full"
									style={{ backgroundColor: "var(--nv-warning)", opacity: 0.7 }}
								/>
								<div
									className="size-2 rounded-full"
									style={{ backgroundColor: "var(--nv-success)", opacity: 0.7 }}
								/>
							</div>
							<span>Secure Terminal // Session 0x4F2A</span>
						</div>
						<span style={{ color: "var(--nv-text-muted)", opacity: 0.5 }}>v4.2.1</span>
					</div>

					<div
						className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5"
						style={{ backgroundColor: "rgba(6,11,20,0.88)", backdropFilter: "blur(8px)" }}
					>
						<div className="space-y-0.5">
							{BOOT_LINES.map(({ tag, text }, i) => (
								<div
									key={`${tag}-${text}`}
									className="nv-mono text-sm/relaxed "
									style={{
										animation: `nv-colony-row-in 350ms var(--nv-ease-emphasis) ${i * 100}ms both`,
									}}
								>
									<span
										style={{
											color:
												tag === "AUTH"
													? "var(--nv-orange)"
													: tag === "SYS"
														? "var(--nv-success)"
														: tag === "NET"
															? "var(--nv-info)"
															: "var(--nv-cyan)",
										}}
									>
										[{tag}]
									</span>{" "}
									<span style={{ color: "var(--nv-text-muted)" }}>{text}</span>
								</div>
							))}
						</div>

						<div
							className="my-5 h-px shrink-0"
							style={{
								background: "var(--nv-glass-stroke)",
								animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${baseDelay - 100}ms both`,
							}}
						/>

						<div
							className="nv-mono nv-caps mb-4 text-xs"
							style={{
								color: "var(--nv-orange)",
								animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${baseDelay - 80}ms both`,
							}}
						>
							// {mode === "signIn" ? "COMMANDER AUTHENTICATION" : "NEW COMMANDER REGISTRATION"}
						</div>

						<form className="space-y-3" onSubmit={handleSubmit}>
							{mode === "signUp" && (
								<div>
									<div className="nv-mono flex items-center gap-2 text-sm">
										<span className="shrink-0" style={{ color: "var(--nv-cyan)" }}>
											{">"} CALLSIGN:
										</span>
										<NvInput
											name="name"
											value={values.name}
											onChange={(event) => handleChange("name", event.target.value)}
											placeholder="commander name"
											autoComplete="name"
											className="
             rounded-none! border-0 border-b border-b-[var(--nv-glass-stroke)]
             bg-transparent!
           "
										/>
									</div>
									<FormFieldError message={errors.name} />
								</div>
							)}

							<div
								style={{
									animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${baseDelay}ms both`,
								}}
							>
								<div className="nv-mono flex items-center gap-2 text-sm">
									<span className="shrink-0" style={{ color: "var(--nv-cyan)" }}>
										{">"} IDENT:
									</span>
									<NvInput
										name="email"
										type="email"
										value={values.email}
										onChange={(event) => handleChange("email", event.target.value)}
										placeholder="commander@fleet.nv"
										autoComplete="email"
										className="
            rounded-none! border-0 border-b border-b-[var(--nv-glass-stroke)]
            bg-transparent!
          "
									/>
								</div>
								<FormFieldError message={errors.email} />
							</div>

							<div
								style={{
									animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${baseDelay + 100}ms both`,
								}}
							>
								<div className="nv-mono flex items-center gap-2 text-sm">
									<span className="shrink-0" style={{ color: "var(--nv-cyan)" }}>
										{">"} PASSKEY:
									</span>
									<NvInput
										name="password"
										type="password"
										value={values.password}
										onChange={(event) => handleChange("password", event.target.value)}
										placeholder="••••••••"
										autoComplete={mode === "signIn" ? "current-password" : "new-password"}
										className="
            rounded-none! border-0 border-b border-b-[var(--nv-glass-stroke)]
            bg-transparent!
          "
									/>
								</div>
								<FormFieldError message={errors.password} />
							</div>

							{mode === "signUp" && (
								<div>
									<div className="nv-mono flex items-center gap-2 text-sm">
										<span className="shrink-0" style={{ color: "var(--nv-cyan)" }}>
											{">"} CONFIRM:
										</span>
										<NvInput
											name="confirmPassword"
											type="password"
											value={values.confirmPassword}
											onChange={(event) => handleChange("confirmPassword", event.target.value)}
											placeholder="••••••••"
											autoComplete="new-password"
											className="
             rounded-none! border-0 border-b border-b-[var(--nv-glass-stroke)]
             bg-transparent!
           "
										/>
									</div>
									<FormFieldError message={errors.confirmPassword} />
								</div>
							)}

							<div
								className="flex items-center gap-3 pt-1"
								style={{
									animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${baseDelay + 250}ms both`,
								}}
							>
								<NvButton
									type="submit"
									variant="ghost"
									size="sm"
									disabled={isSubmitting}
									className="nv-mono nv-caps"
								>
									{">"} {isSubmitting ? "PROCESSING" : mode === "signIn" ? "EXECUTE" : "INITIALIZE"}
									<span
										style={{
											color: "var(--nv-cyan)",
											animation: "cursor-blink 1s step-end infinite",
											marginLeft: 2,
										}}
									>
										|
									</span>
								</NvButton>

								<span className="nv-mono text-xs" style={{ color: "var(--nv-glass-stroke)" }}>
									|
								</span>

								<NvButton
									type="button"
									variant="ghost"
									size="xs"
									className="nv-mono text-xs"
									disabled={isSubmitting}
									onClick={toggleMode}
								>
									{mode === "signIn" ? "[REGISTER]" : "[LOGIN]"}
								</NvButton>
							</div>
						</form>

						<div
							className="my-5 h-px shrink-0"
							style={{
								background: "var(--nv-glass-stroke)",
								animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${logDelay - 100}ms both`,
							}}
						/>

						<div className="mt-auto space-y-0.5">
							<div
								className="nv-mono nv-caps mb-2 text-xs"
								style={{
									color: "var(--nv-text-muted)",
									opacity: 0.5,
									animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${logDelay - 80}ms both`,
								}}
							>
								// SYSTEM LOG
							</div>
							{SYSTEM_LOG.map(({ tag, text }, i) => (
								<div
									key={`${tag}-${text}`}
									className="nv-mono text-xs/relaxed "
									style={{
										opacity: 0.45,
										animation: `nv-colony-row-in 350ms var(--nv-ease-emphasis) ${logDelay + i * 80}ms both`,
									}}
								>
									<span
										style={{
											color: tag === "SYS" ? "var(--nv-success)" : "var(--nv-info)",
										}}
									>
										[{tag}]
									</span>{" "}
									<span style={{ color: "var(--nv-text-muted)" }}>{text}</span>
								</div>
							))}
						</div>
					</div>

					<div
						className="
        nv-mono nv-caps flex shrink-0 justify-between px-4 py-2 text-xs
      "
						style={{
							backgroundColor: "rgba(17,27,47,0.9)",
							borderTop: "1px solid var(--nv-glass-stroke)",
							color: "var(--nv-text-muted)",
							fontSize: 10,
							animation: `nv-colony-row-in 300ms var(--nv-ease-emphasis) ${logDelay + 500}ms both`,
						}}
					>
						<span>TLS 1.3 // AES-256-GCM</span>
						<span className="flex items-center gap-1">
							<span
								className="inline-block size-1.5 rounded-full"
								style={{
									backgroundColor: "var(--nv-success)",
									animation: "nv-queue-pulse 2s ease-in-out infinite",
								}}
							/>
							CONNECTED
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
