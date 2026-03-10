import { cn } from "@/lib/utils";

type NvScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

export function NvScrollArea({ className, ...props }: NvScrollAreaProps) {
	return <div className={cn(`
   overflow-auto pr-1 [scrollbar-color:rgba(126,201,255,0.55)_transparent]
   [scrollbar-width:thin]
   [&::-webkit-scrollbar]:size-2
   [&::-webkit-scrollbar-thumb]:rounded-full
   [&::-webkit-scrollbar-thumb]:bg-[rgba(126,201,255,0.42)]
 `, className)} {...props} />;
}
