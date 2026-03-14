export function formatColonyDuration(value: number, unitMode: "milliseconds" | "seconds"): string {
	const totalSeconds =
		unitMode === "milliseconds" ? Math.max(0, Math.floor(value / 1_000)) : Math.max(0, Math.floor(value));
	const hours = Math.floor(totalSeconds / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}
