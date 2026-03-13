import type { ShipKey } from "@nullvector/game-logic";
import type { ReactNode } from "react";

import { Anchor, Clock3, Layers3, Minus, Package, Plus, Ship, X, Zap } from "lucide-react";

import {
	CostPill,
	formatDuration,
	LockWarningPopover,
	type QueueItem,
	SHIP_GROUPS,
} from "./shipyard-mock-shared";

type ResourceCost = {
	alloy: number;
	crystal: number;
	fuel: number;
};

type AvailableResources = {
	alloy: number;
	crystal: number;
	fuel: number;
};

export type ShipyardDisplayShip = {
	cargoCapacity: number;
	cost: ResourceCost;
	key: ShipKey;
	name: string;
	owned: number;
	perUnitDurationSeconds: number;
	queued: number;
	requiredShipyardLevel: number;
	speed: number;
};

export type ShipyardScreenView = {
	lane: {
		isFull: boolean;
	};
	ships: ShipyardDisplayShip[];
	shipyardLevel: number;
};

type ShipyardPresentation = {
	description: string;
	image: string;
};

type ShipAvailability = {
	badgeClassName: string;
	buttonLabel: string;
	canAffordSelectedQuantity: boolean;
	isStructurallyAvailable: boolean;
	label: string;
	lockedByLevel: boolean;
	warning?: string;
};

type ShipCardProps = {
	availableResources: AvailableResources;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	editingShipKey: ShipKey | null;
	isSavingShipCount: boolean;
	onDecrementQuantity: (shipKey: ShipKey, currentQuantity: number) => void;
	onEditShip: (shipKey: ShipKey, currentCount: number) => void;
	onIncrementQuantity: (shipKey: ShipKey, currentQuantity: number) => void;
	onQuantityBlur: (shipKey: ShipKey, currentQuantity: number) => void;
	onQuantityInputChange: (shipKey: ShipKey, value: string) => void;
	onQueueShip: (ship: ShipyardDisplayShip, quantity: number) => void;
	onShipDraftCancel: () => void;
	onShipDraftChange: (value: string) => void;
	onShipDraftCommit: (shipKey: ShipKey) => void;
	quantityInput: string;
	shipDraftValue: string;
	ship: ShipyardDisplayShip;
	shipIndex: number;
	shipyardLevel: number;
	isQueueing: boolean;
	isQueueFull: boolean;
	quantity: number;
};

type ShipyardScreenProps = {
	activeQueueItem: QueueItem | null;
	activeUpgradeProgress: number;
	availableResources: AvailableResources;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	cancelingQueueItemId: string | null;
	editingShipKey: ShipKey | null;
	isCompletingQueueItem: boolean;
	onCancelQueueItem: (id: string) => void;
	onCompleteActiveQueueItem: () => void;
	onDecrementQuantity: (shipKey: ShipKey, currentQuantity: number) => void;
	onEditShip: (shipKey: ShipKey, currentCount: number) => void;
	onIncrementQuantity: (shipKey: ShipKey, currentQuantity: number) => void;
	onQuantityBlur: (shipKey: ShipKey, currentQuantity: number) => void;
	onQuantityInputChange: (shipKey: ShipKey, value: string) => void;
	onQueueShip: (ship: ShipyardDisplayShip, quantity: number) => void;
	onShipDraftCancel: () => void;
	onShipDraftChange: (value: string) => void;
	onShipDraftCommit: (shipKey: ShipKey) => void;
	pendingQueueItems: QueueItem[];
	quantities: Partial<Record<ShipKey, number>>;
	quantityInputs: Partial<Record<ShipKey, string>>;
	queueingShipKey: ShipKey | null;
	savingShipKey: ShipKey | null;
	shipDraftValue: string;
	view: ShipyardScreenView;
};

const SHIP_PRESENTATION: Record<ShipKey, ShipyardPresentation> = {
	smallCargo: {
		description: "Short-haul freighter for balancing alloy and crystal across nearby colonies.",
		image: "/game-icons/ships/small-cargo.png",
	},
	largeCargo: {
		description: "Bulk logistics hull with expanded cargo pods and reinforced engines.",
		image: "/game-icons/ships/large-cargo.png",
	},
	colonyShip: {
		description: "Ark-class expansion vessel carrying habitat modules and colony command systems.",
		image: "/game-icons/ships/colony-ship.png",
	},
	interceptor: {
		description: "Fast-response strike craft built for pursuit, screening, and light interception.",
		image: "/game-icons/ships/interceptor.png",
	},
	frigate: {
		description: "Line escort vessel balancing durability and sustained medium-range firepower.",
		image: "/game-icons/ships/frigate.png",
	},
	cruiser: {
		description: "Heavy combat platform designed to break fleets and pressure hardened targets.",
		image: "/game-icons/ships/cruiser.png",
	},
	bomber: {
		description: "Siege hull carrying high-yield payloads for defense suppression and strike runs.",
		image: "/game-icons/ships/bomber.png",
	},
};

export function ShipyardScreen(props: ShipyardScreenProps) {
	const {
		activeQueueItem,
		activeUpgradeProgress,
		availableResources,
		canShowDevUi,
		canUseDevConsole,
		cancelingQueueItemId,
		editingShipKey,
		isCompletingQueueItem,
		onCancelQueueItem,
		onCompleteActiveQueueItem,
		onDecrementQuantity,
		onEditShip,
		onIncrementQuantity,
		onQuantityBlur,
		onQuantityInputChange,
		onQueueShip,
		onShipDraftCancel,
		onShipDraftChange,
		onShipDraftCommit,
		pendingQueueItems,
		quantities,
		quantityInputs,
		queueingShipKey,
		savingShipKey,
		shipDraftValue,
		view,
	} = props;

	const fleetTotal = view.ships.reduce((sum, ship) => sum + ship.owned, 0);
	const totalQueued = view.ships.reduce((sum, ship) => sum + ship.queued, 0);
	const queueItemsCount = (activeQueueItem ? 1 : 0) + pendingQueueItems.length;

	return (
		<div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-12 text-white">
			<div
				className="
      grid gap-5
      lg:grid-cols-[minmax(0,1fr)_450px]
    "
			>
				<div className="space-y-5">
					<ShipyardSummaryStrip
						activeQueueItem={activeQueueItem}
						fleetTotal={fleetTotal}
						ships={view.ships}
						shipyardLevel={view.shipyardLevel}
						totalQueued={totalQueued}
					/>

					<ShipCatalogSection shipCount={view.ships.length}>
						{SHIP_GROUPS.map((group) => {
							const groupShips = group.keys
								.map((key) => view.ships.find((ship) => ship.key === key))
								.filter((ship): ship is ShipyardDisplayShip => ship != null);
							if (groupShips.length === 0) {
								return null;
							}

							return (
								<div key={group.label}>
									<p
										className="
            mb-2 text-[10px] font-semibold tracking-[0.14em] text-white/35
            uppercase
          "
									>
										{group.label}
									</p>
									<div className="space-y-2">
										{groupShips.map((ship) => {
											const quantity = quantities[ship.key] ?? 1;
											return (
												<ShipCard
													availableResources={availableResources}
													canShowDevUi={canShowDevUi}
													canUseDevConsole={canUseDevConsole}
													editingShipKey={editingShipKey}
													isQueueFull={view.lane.isFull}
													isQueueing={queueingShipKey === ship.key}
													isSavingShipCount={savingShipKey === ship.key}
													key={ship.key}
													onDecrementQuantity={onDecrementQuantity}
													onEditShip={onEditShip}
													onIncrementQuantity={onIncrementQuantity}
													onQuantityBlur={onQuantityBlur}
													onQuantityInputChange={onQuantityInputChange}
													onQueueShip={onQueueShip}
													onShipDraftCancel={onShipDraftCancel}
													onShipDraftChange={onShipDraftChange}
													onShipDraftCommit={onShipDraftCommit}
													quantity={quantity}
													quantityInput={quantityInputs[ship.key] ?? String(quantity)}
													shipDraftValue={shipDraftValue}
													ship={ship}
													shipIndex={view.ships.indexOf(ship)}
													shipyardLevel={view.shipyardLevel}
												/>
											);
										})}
									</div>
								</div>
							);
						})}
					</ShipCatalogSection>
				</div>

				<div className="lg:sticky lg:top-4 lg:self-start">
					<CommandQueuePanel
						activeQueueItem={activeQueueItem}
						activeUpgradeProgress={activeUpgradeProgress}
						canShowDevUi={canShowDevUi}
						cancelingQueueItemId={cancelingQueueItemId}
						isCompletingQueueItem={isCompletingQueueItem}
						onCancelQueueItem={onCancelQueueItem}
						onCompleteActiveQueueItem={onCompleteActiveQueueItem}
						pendingQueueItems={pendingQueueItems}
						queueItemsCount={queueItemsCount}
						ships={view.ships}
					/>
				</div>
			</div>
		</div>
	);
}

function ShipyardSummaryStrip(props: {
	activeQueueItem: QueueItem | null;
	fleetTotal: number;
	ships: ShipyardDisplayShip[];
	shipyardLevel: number;
	totalQueued: number;
}) {
	const { activeQueueItem, fleetTotal, ships, shipyardLevel, totalQueued } = props;

	return (
		<div
			className="
     rounded-2xl border border-white/10
     bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))] p-4
   "
		>
			<div className="flex items-center gap-3">
				<div
					className="
       flex size-8 items-center justify-center rounded-lg border
       border-cyan-300/25 bg-cyan-400/8
     "
				>
					<Anchor className="size-4 text-cyan-300" />
				</div>
				<div>
					<h1 className="font-(family-name:--nv-font-display) text-lg font-bold">Shipyard</h1>
					<p className="text-[10px] text-white/40">
						Level {shipyardLevel} • {fleetTotal} ships
						{totalQueued > 0 ? ` • ${totalQueued} in queue` : ""}
						{activeQueueItem ? " • 1 building" : ""}
					</p>
				</div>
			</div>

			<div className="mt-4 space-y-3">
				{SHIP_GROUPS.map((group) => {
					const groupShips = group.keys
						.map((key) => ships.find((ship) => ship.key === key))
						.filter((ship): ship is ShipyardDisplayShip => ship != null);
					if (groupShips.length === 0) {
						return null;
					}

					return (
						<div key={group.label}>
							<p
								className="
          mb-1.5 text-[9px] font-semibold tracking-[0.12em] text-white/30
          uppercase
        "
							>
								{group.label}
							</p>
							<div
								className="
          grid grid-cols-2 gap-2
          sm:grid-cols-3
          md:grid-cols-4
        "
							>
								{groupShips.map((ship) => (
									<SummaryShipCard key={ship.key} ship={ship} />
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function SummaryShipCard(props: { ship: ShipyardDisplayShip }) {
	const { ship } = props;
	const image = SHIP_PRESENTATION[ship.key].image;
	const hasAny = ship.owned > 0 || ship.queued > 0;
	const ownedShare =
		ship.owned + ship.queued > 0
			? Math.min(100, (ship.owned / (ship.owned + ship.queued)) * 100)
			: 100;

	return (
		<div className={`
    relative overflow-hidden rounded-xl border p-2.5 transition-colors
    ${hasAny ? "border-white/10 bg-white/[0.035]" : `
      border-white/6 bg-white/[0.015] opacity-50
    `}
  `}>
			<div className="flex items-center gap-2">
				<img
					alt={ship.name}
					className="
       size-8 shrink-0 rounded-md border border-white/8 bg-black/30
       object-contain p-0.5
     "
					src={image}
				/>
				<div className="min-w-0">
					<p className="truncate text-xs font-semibold">{ship.name}</p>
					<p className="font-(family-name:--nv-font-mono) text-[10px] text-white/50">
						{ship.owned}
					</p>
				</div>
			</div>
			<div className="mt-2 flex justify-between text-[9px]">
				<span className="text-emerald-300/70">{ship.owned} owned</span>
				{ship.queued > 0 ? <span className="text-cyan-200/50">{ship.queued} queued</span> : null}
			</div>
			<div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/8">
				<div className="h-full rounded-full bg-cyan-400/40" style={{ width: `${ownedShare}%` }} />
			</div>
		</div>
	);
}

function ShipCatalogSection(props: { children: ReactNode; shipCount: number }) {
	const { children, shipCount } = props;

	return (
		<section
			className="
     overflow-hidden rounded-2xl border border-l-4 border-white/10
     border-l-cyan-400/50
     bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))]
   "
			style={{
				animation: "nv-resource-card-in 400ms cubic-bezier(0.21,1,0.34,1) both",
			}}
		>
			<div
				className="
      flex flex-wrap items-center justify-between gap-2 px-4 py-3
      sm:px-5
    "
			>
				<div className="flex items-center gap-2.5">
					<span className="text-white/50">
						<Ship className="size-4" strokeWidth={2.2} />
					</span>
					<div>
						<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">Ship Catalog</h2>
						<p className="mt-0.5 text-[10px] text-white/35">
							Commission new vessels from the orbital assembly line.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5">
					<span
						className="
        rounded-md border border-white/10 bg-white/3 px-2 py-0.5
        font-(family-name:--nv-font-mono) text-[9px] font-semibold text-white/50
      "
					>
						{shipCount} designs
					</span>
				</div>
			</div>

			<div
				className="
      border-t border-white/6 p-3
      sm:p-4
    "
			>
				<div className="space-y-5">{children}</div>
			</div>
		</section>
	);
}

function ShipCard(props: ShipCardProps) {
	const {
		availableResources,
		canShowDevUi,
		canUseDevConsole,
		editingShipKey,
		isQueueFull,
		isQueueing,
		isSavingShipCount,
		onDecrementQuantity,
		onEditShip,
		onIncrementQuantity,
		onQuantityBlur,
		onQuantityInputChange,
		onQueueShip,
		onShipDraftCancel,
		onShipDraftChange,
		onShipDraftCommit,
		quantity,
		quantityInput,
		shipDraftValue,
		ship,
		shipIndex,
		shipyardLevel,
	} = props;
	const presentation = SHIP_PRESENTATION[ship.key];
	const availability = getShipAvailability({
		availableResources,
		isQueueFull,
		quantity,
		ship,
		shipyardLevel,
	});

	return (
		<article
			className={`
     group relative overflow-hidden rounded-xl border
     ${availability.lockedByLevel ? `border-white/8 opacity-60 grayscale` : `
               border-white/10
             `}
     bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
     text-[13px]
   `}
			style={{
				animation: "nv-resource-card-in 380ms cubic-bezier(0.21,1,0.34,1) both",
				animationDelay: `${120 + shipIndex * 40}ms`,
			}}
		>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-px"
				style={{
					background: "linear-gradient(90deg, transparent, rgba(74,233,255,0.5), transparent)",
				}}
			/>

			<div
				className="
      relative z-10 p-3
      sm:p-4
    "
			>
				<div className="flex items-center gap-3">
					<img
						alt={ship.name}
						className="
        size-10 shrink-0 rounded-lg border border-white/8 bg-black/30
        object-contain p-1
      "
						src={presentation.image}
					/>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h3 className="font-(family-name:--nv-font-display) text-sm font-bold">
								{ship.name}
							</h3>
							<span className={`
         inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px]
         font-semibold whitespace-nowrap uppercase
         ${availability.badgeClassName}
       `}>{availability.label}</span>
							{availability.warning ? <LockWarningPopover message={availability.warning} /> : null}
						</div>
						<p className="mt-0.5 text-[11px] leading-snug text-white/40">
							{presentation.description}
						</p>
					</div>
					{canShowDevUi && editingShipKey === ship.key ? (
						<input
							className="
         inline-flex h-7 w-14 shrink-0 items-center justify-center rounded-md
         border border-cyan-300/35 bg-black/45 px-1 text-center
         font-(family-name:--nv-font-mono) text-[10px] font-bold text-cyan-100
         outline-none
         focus:border-cyan-200/60
       "
							inputMode="numeric"
							onBlur={onShipDraftCancel}
							onChange={(event) => {
								onShipDraftChange(event.target.value.replace(/[^\d]/g, ""));
							}}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									onShipDraftCancel();
									return;
								}
								if (event.key === "Enter") {
									event.preventDefault();
									onShipDraftCommit(ship.key);
								}
							}}
							value={shipDraftValue}
						/>
					) : canShowDevUi ? (
						<button
							className="
         inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md
         border border-cyan-300/20 bg-cyan-400/8 px-1.5
         font-(family-name:--nv-font-mono) text-[10px] font-bold text-cyan-100
         transition
         hover:border-cyan-200/45 hover:bg-cyan-400/14
         disabled:cursor-not-allowed disabled:opacity-50
       "
							disabled={!canUseDevConsole || isSavingShipCount}
							onClick={() => onEditShip(ship.key, ship.owned)}
							title={`${ship.owned} owned`}
							type="button"
						>
							{ship.owned}
						</button>
					) : (
						<span
							className="
         inline-flex size-7 shrink-0 items-center justify-center rounded-md
         border border-white/15 bg-black/25 font-(family-name:--nv-font-mono)
         text-[11px] font-bold text-white/80
       "
							title={`${ship.owned} owned`}
						>
							{ship.owned}
						</span>
					)}
				</div>

				<div
					className="
       mt-3 flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-white/6
       pt-3
     "
				>
					<div className="flex gap-3 text-[10px]">
						<div>
							<span className="text-[8px] tracking-wider text-white/30 uppercase">Cargo</span>
							<p className="font-(family-name:--nv-font-mono) font-bold text-white/75">
								{ship.cargoCapacity.toLocaleString()}
							</p>
						</div>
						<div>
							<span className="text-[8px] tracking-wider text-white/30 uppercase">Speed</span>
							<p className="font-(family-name:--nv-font-mono) font-bold text-white/75">
								{ship.speed.toLocaleString()}
							</p>
						</div>
						<div>
							<span className="text-[8px] tracking-wider text-white/30 uppercase">Build</span>
							<p className="font-(family-name:--nv-font-mono) font-bold text-white/75">
								{formatDuration(ship.perUnitDurationSeconds)}
							</p>
						</div>
					</div>

					<div className="flex gap-1">
						<CostPill amount={ship.cost.alloy * quantity} kind="alloy" label="Alloy" />
						<CostPill amount={ship.cost.crystal * quantity} kind="crystal" label="Crystal" />
						<CostPill amount={ship.cost.fuel * quantity} kind="fuel" label="Fuel" />
					</div>

					<div className="ml-auto flex items-center gap-2">
						<QuantityStepper
							canEdit={availability.isStructurallyAvailable}
							onBlur={() => onQuantityBlur(ship.key, quantity)}
							onChange={(value) => onQuantityInputChange(ship.key, value)}
							onDecrement={() => onDecrementQuantity(ship.key, quantity)}
							onIncrement={() => onIncrementQuantity(ship.key, quantity)}
							quantity={quantity}
							value={quantityInput}
						/>

						<button
							className="
         flex items-center gap-1.5 rounded-lg border border-cyan-200/50
         bg-linear-to-b from-cyan-400/25 to-cyan-400/10 px-3 py-1.5
         font-(family-name:--nv-font-display) text-[11px] font-bold
         tracking-[0.06em] text-cyan-50 uppercase
         shadow-[0_0_16px_rgba(61,217,255,0.10)] transition-all
         hover:border-cyan-100/70 hover:shadow-[0_0_24px_rgba(61,217,255,0.2)]
         disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30
         disabled:shadow-none
       "
							disabled={
								!availability.isStructurallyAvailable ||
								!availability.canAffordSelectedQuantity ||
								isQueueing
							}
							onClick={() => onQueueShip(ship, quantity)}
						>
							<Zap className="size-3" />
							{isQueueing ? "..." : availability.buttonLabel}
						</button>
					</div>
				</div>
			</div>
		</article>
	);
}

function QuantityStepper(props: {
	canEdit: boolean;
	onBlur: () => void;
	onChange: (value: string) => void;
	onDecrement: () => void;
	onIncrement: () => void;
	quantity: number;
	value: string;
}) {
	const { canEdit, onBlur, onChange, onDecrement, onIncrement, quantity, value } = props;

	return (
		<div
			className="flex items-center rounded-lg border border-white/12 bg-black/25"
		>
			<button
				className="
      flex size-7 items-center justify-center text-white/60
      disabled:opacity-25
    "
				disabled={!canEdit || quantity <= 1}
				onClick={onDecrement}
			>
				<Minus className="size-3" />
			</button>
			<input
				className="
      w-10 [appearance:textfield] bg-transparent px-0.5 text-center
      font-(family-name:--nv-font-mono) text-xs font-bold text-white
      outline-none
      [&::-webkit-inner-spin-button]:appearance-none
      [&::-webkit-outer-spin-button]:appearance-none
    "
				max={10_000}
				min={1}
				onBlur={onBlur}
				onChange={(event) => onChange(event.target.value)}
				type="number"
				value={value}
			/>
			<button
				className="
      flex size-7 items-center justify-center text-white/60
      disabled:opacity-25
    "
				disabled={!canEdit}
				onClick={onIncrement}
			>
				<Plus className="size-3" />
			</button>
		</div>
	);
}

function CommandQueuePanel(props: {
	activeQueueItem: QueueItem | null;
	activeUpgradeProgress: number;
	canShowDevUi: boolean;
	cancelingQueueItemId: string | null;
	isCompletingQueueItem: boolean;
	onCancelQueueItem: (id: string) => void;
	onCompleteActiveQueueItem: () => void;
	pendingQueueItems: QueueItem[];
	queueItemsCount: number;
	ships: ShipyardDisplayShip[];
}) {
	const {
		activeQueueItem,
		activeUpgradeProgress,
		canShowDevUi,
		cancelingQueueItemId,
		isCompletingQueueItem,
		onCancelQueueItem,
		onCompleteActiveQueueItem,
		pendingQueueItems,
		queueItemsCount,
		ships,
	} = props;

	return (
		<div
			className="
     rounded-2xl border border-white/12
     bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
   "
		>
			<div
				className="flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5"
			>
				<Clock3 className="size-5 text-cyan-300" />
				<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">Command Queue</h2>
				{queueItemsCount > 0 ? (
					<span
						className="
        ml-auto font-(family-name:--nv-font-mono) text-[9px] text-white/30
      "
					>
						{queueItemsCount} item{queueItemsCount !== 1 ? "s" : ""}
					</span>
				) : null}
			</div>

			<div className="p-5">
				{activeQueueItem ? (
					<ActiveQueueCard
						activeQueueItem={activeQueueItem}
						activeUpgradeProgress={activeUpgradeProgress}
						canShowDevUi={canShowDevUi}
						cancelingQueueItemId={cancelingQueueItemId}
						isCompletingQueueItem={isCompletingQueueItem}
						onCancelQueueItem={onCancelQueueItem}
						onCompleteActiveQueueItem={onCompleteActiveQueueItem}
						ships={ships}
					/>
				) : null}

				{pendingQueueItems.length > 0 ? (
					<PendingQueueList
						activeQueueItem={activeQueueItem}
						cancelingQueueItemId={cancelingQueueItemId}
						items={pendingQueueItems}
						onCancelQueueItem={onCancelQueueItem}
						ships={ships}
					/>
				) : null}

				{queueItemsCount === 0 ? <EmptyQueueState /> : null}
			</div>
		</div>
	);
}

function ActiveQueueCard(props: {
	activeQueueItem: QueueItem;
	activeUpgradeProgress: number;
	canShowDevUi: boolean;
	cancelingQueueItemId: string | null;
	isCompletingQueueItem: boolean;
	onCancelQueueItem: (id: string) => void;
	onCompleteActiveQueueItem: () => void;
	ships: ShipyardDisplayShip[];
}) {
	const {
		activeQueueItem,
		activeUpgradeProgress,
		canShowDevUi,
		cancelingQueueItemId,
		isCompletingQueueItem,
		onCancelQueueItem,
		onCompleteActiveQueueItem,
		ships,
	} = props;
	const activeShip = ships.find((ship) => ship.name === activeQueueItem.shipName);
	const activeImage = activeShip ? SHIP_PRESENTATION[activeShip.key].image : null;

	return (
		<div className="space-y-3">
			<p
				className="
      text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
    "
			>
				Active
			</p>
			<div className="rounded-xl border border-emerald-300/20 bg-emerald-400/4 p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2.5">
						{activeImage ? (
							<img
								alt={activeQueueItem.shipName}
								className="
          size-10 rounded-lg border border-white/8 bg-black/30 object-contain
          p-1
        "
								src={activeImage}
							/>
						) : null}
						<div>
							<p className="text-xs font-semibold">{activeQueueItem.shipName}</p>
							<p
								className="
          mt-0.5 font-(family-name:--nv-font-mono) text-[10px] text-white/40
        "
							>
								{activeQueueItem.remaining.toLocaleString()} of{" "}
								{activeQueueItem.total.toLocaleString()} remaining
							</p>
						</div>
					</div>
					<div className="flex items-center gap-1.5">
						{canShowDevUi ? (
							<button
								className="
          rounded-md border border-cyan-300/20 bg-cyan-400/8 px-2 py-1
          text-[10px] font-medium text-cyan-100 transition-colors
          hover:border-cyan-200/35 hover:bg-cyan-400/12
          disabled:cursor-not-allowed disabled:opacity-50
        "
								disabled={isCompletingQueueItem}
								onClick={onCompleteActiveQueueItem}
								type="button"
							>
								{isCompletingQueueItem ? "..." : "Complete"}
							</button>
						) : null}
						<button
							className="
         rounded-md border border-rose-300/20 bg-rose-400/8 px-2 py-1
         text-[10px] font-medium text-rose-200/80 transition-colors
         hover:border-rose-200/35 hover:bg-rose-400/12
       "
							disabled={cancelingQueueItemId === activeQueueItem.id}
							onClick={() => onCancelQueueItem(activeQueueItem.id)}
							type="button"
						>
							{cancelingQueueItemId === activeQueueItem.id ? (
								"..."
							) : (
								<X
									className="size-3"
								/>
							)}
						</button>
					</div>
				</div>

				<div className="mt-2 flex items-center justify-between text-right">
					<div className="flex items-center gap-1.5">
						<Layers3 className="size-3 text-emerald-300/50" />
						<span
							className="font-(family-name:--nv-font-mono) text-[10px] text-white/40"
						>
							Batch {activeQueueItem.total.toLocaleString()}
						</span>
					</div>
					<div>
						<p
							className="
         font-(family-name:--nv-font-mono) text-xs font-bold text-emerald-200
       "
						>
							{formatDuration(activeQueueItem.timeLeftSeconds)}
						</p>
						<p
							className="
         font-(family-name:--nv-font-mono) text-[8px] tracking-widest
         text-emerald-200/45 uppercase
       "
						>
							remaining
						</p>
					</div>
				</div>

				<div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/8">
					<div
						className="
        h-full rounded-full bg-linear-to-r from-emerald-400/60 to-emerald-300/40
        transition-all
      "
						style={{ width: `${activeUpgradeProgress}%` }}
					/>
				</div>
				<div className="mt-1 flex items-center justify-between">
					<span
						className="font-(family-name:--nv-font-mono) text-[9px] text-white/25"
					>
						{Math.round(activeUpgradeProgress)}%
					</span>
					<span
						className="inline-flex items-center gap-1 text-[9px] text-emerald-300/60"
					>
						<span
							className="inline-block size-1.5 rounded-full bg-emerald-400"
							style={{
								animation: "nv-queue-pulse 2s ease-in-out infinite",
							}}
						/>
						Building
					</span>
				</div>
			</div>
		</div>
	);
}

function PendingQueueList(props: {
	activeQueueItem: QueueItem | null;
	cancelingQueueItemId: string | null;
	items: QueueItem[];
	onCancelQueueItem: (id: string) => void;
	ships: ShipyardDisplayShip[];
}) {
	const { activeQueueItem, cancelingQueueItemId, items, onCancelQueueItem, ships } = props;

	return (
		<div className={activeQueueItem ? "mt-4" : ""}>
			<p
				className="
      text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
    "
			>
				Pending ({items.length})
			</p>
			<div className="mt-2 space-y-1">
				{items.map((item, index) => {
					const pendingShip = ships.find((ship) => ship.name === item.shipName);
					const pendingImage = pendingShip ? SHIP_PRESENTATION[pendingShip.key].image : null;

					return (
						<div
							className="
         flex items-center justify-between rounded-lg border border-white/6
         bg-white/2 px-3 py-2
       "
							key={item.id}
						>
							<div className="flex items-center gap-2">
								<span
									className="
           flex size-5 items-center justify-center rounded-sm
           font-(family-name:--nv-font-mono) text-[9px] font-bold text-white/25
         "
								>
									{index + 1}
								</span>
								{pendingImage ? (
									<img
										alt={item.shipName}
										className="
            size-6 rounded-sm border border-white/8 bg-black/20 object-contain
            p-0.5
          "
										src={pendingImage}
									/>
								) : null}
								<div>
									<p className="text-[11px] font-semibold text-white/80">{item.shipName}</p>
									<p
										className="font-(family-name:--nv-font-mono) text-[9px] text-white/30"
									>
										{item.total.toLocaleString()} ships • {formatDuration(item.timeLeftSeconds)}
									</p>
								</div>
							</div>
							<button
								className="
          rounded-md border border-rose-300/20 bg-rose-400/8 px-2 py-1
          text-[10px] font-medium text-rose-200/80 transition-colors
          hover:border-rose-200/35 hover:bg-rose-400/12
        "
								disabled={cancelingQueueItemId === item.id}
								onClick={() => onCancelQueueItem(item.id)}
							>
								{cancelingQueueItemId === item.id ? "..." : "Cancel"}
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function EmptyQueueState() {
	return (
		<div className="flex flex-col items-center py-8 text-center">
			<div
				className="
      flex size-12 items-center justify-center rounded-full border
      border-white/8 bg-white/3
    "
			>
				<Package className="size-5 text-white/20" />
			</div>
			<p className="mt-3 text-xs font-medium text-white/30">No active builds</p>
			<p className="mt-1 text-[10px] text-white/18">Select a ship to begin construction</p>
		</div>
	);
}

function getShipAvailability(args: {
	availableResources: AvailableResources;
	isQueueFull: boolean;
	quantity: number;
	ship: ShipyardDisplayShip;
	shipyardLevel: number;
}): ShipAvailability {
	const { availableResources, isQueueFull, quantity, ship, shipyardLevel } = args;
	const lockedByLevel = shipyardLevel < ship.requiredShipyardLevel;
	const isStructurallyAvailable = !lockedByLevel && !isQueueFull;
	const canAffordSelectedQuantity =
		availableResources.alloy >= ship.cost.alloy * quantity &&
		availableResources.crystal >= ship.cost.crystal * quantity &&
		availableResources.fuel >= ship.cost.fuel * quantity;

	if (lockedByLevel) {
		return {
			badgeClassName: "border-amber-300/35 bg-amber-400/10 text-amber-200/80",
			buttonLabel: "Locked",
			canAffordSelectedQuantity,
			isStructurallyAvailable,
			label: "Locked",
			lockedByLevel,
			warning: `Requires Shipyard Level ${ship.requiredShipyardLevel} (current: ${shipyardLevel}).`,
		};
	}

	if (isQueueFull) {
		return {
			badgeClassName: "border-rose-300/35 bg-rose-400/10 text-rose-200/80",
			buttonLabel: "Full",
			canAffordSelectedQuantity,
			isStructurallyAvailable,
			label: "Queue Full",
			lockedByLevel,
		};
	}

	if (!canAffordSelectedQuantity) {
		return {
			badgeClassName: "border-white/15 bg-white/6 text-white/70",
			buttonLabel: "Need Res.",
			canAffordSelectedQuantity,
			isStructurallyAvailable,
			label: "Need Resources",
			lockedByLevel,
		};
	}

	if (ship.queued > 0) {
		return {
			badgeClassName: "border-cyan-300/30 bg-cyan-400/8 text-cyan-200/80",
			buttonLabel: `Queue ${quantity}`,
			canAffordSelectedQuantity,
			isStructurallyAvailable,
			label: `${ship.queued.toLocaleString()} Queued`,
			lockedByLevel,
		};
	}

	return {
		badgeClassName: "border-emerald-300/30 bg-emerald-400/8 text-emerald-200/80",
		buttonLabel: `Queue ${quantity}`,
		canAffordSelectedQuantity,
		isStructurallyAvailable,
		label: "Available",
		lockedByLevel,
	};
}
