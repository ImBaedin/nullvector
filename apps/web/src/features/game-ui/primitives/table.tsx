import { cn } from "@/lib/utils";

type NvTableProps = React.TableHTMLAttributes<HTMLTableElement>;

export function NvTable({ className, ...props }: NvTableProps) {
	return (
		<div className="
    overflow-hidden rounded-(--nv-r-md) border
    border-(--nv-glass-stroke) bg-[rgba(7,14,26,0.66)]
  ">
			<table
				className={cn(
					`
       w-full text-left text-sm
       [&_tbody_td]:px-3 [&_tbody_td]:py-2
       [&_tbody_tr]:border-t [&_tbody_tr]:border-[rgba(255,255,255,0.08)]
       [&_th]:px-3 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-medium
       [&_th]:tracking-[0.18em] [&_th]:uppercase
     `,
					className,
				)}
				{...props}
			/>
		</div>
	);
}
