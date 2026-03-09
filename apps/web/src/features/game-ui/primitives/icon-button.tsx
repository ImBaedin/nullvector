import { cn } from "@/lib/utils";

import { NvButton, type NvButtonProps } from "./button";

type NvIconButtonProps = Omit<NvButtonProps, "size"> & {
	label: string;
};

export function NvIconButton({ className, label, children, ...props }: NvIconButtonProps) {
	return (
		<NvButton
			aria-label={label}
			className={cn(`
     size-9  shrink-0
     [&_svg]:size-4
   `, className)}
			size="icon"
			{...props}
		>
			{children}
		</NvButton>
	);
}
