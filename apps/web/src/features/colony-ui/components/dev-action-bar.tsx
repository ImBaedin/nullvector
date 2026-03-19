import type { ReactNode } from "react";

export function DevActionBar(props: { children: ReactNode }) {
	return <div className="flex items-center gap-1.5">{props.children}</div>;
}
