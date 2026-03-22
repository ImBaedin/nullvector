import type { CSSProperties } from "react";
import type { ToasterProps } from "sonner";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			// Always dark — this is a game UI
			theme="dark"
			className="toaster group"
			gap={8}
			icons={{
				success: <CircleCheckIcon className="size-4 text-emerald-400" />,
				info: <InfoIcon className="size-4 text-cyan-400/80" />,
				warning: <TriangleAlertIcon className="size-4 text-amber-400/80" />,
				error: <OctagonXIcon className="size-4 text-rose-400/80" />,
				loading: <Loader2Icon className="size-4 animate-spin text-white/40" />,
			}}
			style={
				{
					// Minimal variable overrides — the .nv-toast CSS class handles
					// background, border, border-radius, shadow, and backdrop-filter
					// via !important rules so these are mainly fallback/text color hints.
					"--normal-text": "#edf5ff",
					"--success-text": "#edf5ff",
					"--error-text": "#edf5ff",
					"--warning-text": "#edf5ff",
					"--info-text": "#edf5ff",
					"--border-radius": "10px",
					"--font-size": "13px",
				} as CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: "nv-toast",
					title: "nv-toast-title",
					description: "nv-toast-description",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
