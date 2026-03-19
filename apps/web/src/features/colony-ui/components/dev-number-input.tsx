import { NvInput } from "@/features/game-ui/primitives/input";
import { cn } from "@/lib/utils";

type DevNumberInputProps = {
	autoFocus?: boolean;
	disabled?: boolean;
	onBlur?: () => void;
	onCancel: () => void;
	onChange: (value: string) => void;
	onCommit: () => void;
	value: string;
};

export function DevNumberInput(props: DevNumberInputProps) {
	return (
		<NvInput
			autoFocus={props.autoFocus}
			className={cn(
				"h-6 w-14 border-cyan-300/35 bg-black/45 px-1 text-center",
				"font-(family-name:--nv-font-mono) text-[10px] font-bold text-cyan-100",
				"focus-visible:ring-cyan-300/30",
			)}
			disabled={props.disabled}
			inputMode="numeric"
			onBlur={props.onBlur}
			onChange={(event) => props.onChange(event.target.value)}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					props.onCancel();
					return;
				}
				if (event.key === "Enter") {
					event.preventDefault();
					props.onCommit();
				}
			}}
			value={props.value}
		/>
	);
}
