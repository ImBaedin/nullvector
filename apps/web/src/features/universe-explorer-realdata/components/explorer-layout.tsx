type ExplorerLayoutProps = {
	sidebar: React.ReactNode;
	canvas: React.ReactNode;
	hoverPanel: React.ReactNode;
};

export function ExplorerLayout({ sidebar, canvas, hoverPanel }: ExplorerLayoutProps) {
	return (
		<div
			className="
    relative h-full min-h-0 overflow-hidden bg-[#050912] text-white
  "
		>
			<div
				className="
      grid h-full min-h-0 grid-cols-1
      lg:grid-cols-[320px_minmax(0,1fr)]
    "
			>
				<aside
					className="
       border-b border-white/10 bg-[#070f1d] p-4
       lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0
     "
				>
					{sidebar}
				</aside>
				<section className="relative min-h-0">{canvas}</section>
			</div>
			{hoverPanel}
		</div>
	);
}
