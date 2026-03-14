type QuantityStepperProps = {
	canEdit: boolean;
	max: number;
	min: number;
	onBlur: () => void;
	onChange: (value: string) => void;
	onDecrement: () => void;
	onIncrement: () => void;
	quantity: number;
	value: string;
};

export function QuantityStepper(props: QuantityStepperProps) {
	const { canEdit, max, min, onBlur, onChange, onDecrement, onIncrement, quantity, value } = props;

	return (
		<div className="flex items-center rounded-lg border border-white/12 bg-black/25">
			<button
				className="flex size-7 items-center justify-center text-white/60 disabled:opacity-25"
				disabled={!canEdit || quantity <= min}
				onClick={onDecrement}
				type="button"
			>
				<span className="text-sm leading-none">-</span>
			</button>
			<input
				className="
					w-10 [appearance:textfield] bg-transparent px-0.5 text-center
					font-(family-name:--nv-font-mono) text-xs font-bold text-white
					outline-none disabled:opacity-50
					[&::-webkit-inner-spin-button]:appearance-none
					[&::-webkit-outer-spin-button]:appearance-none
				"
				disabled={!canEdit}
				max={max}
				min={min}
				onBlur={onBlur}
				onChange={(event) => onChange(event.target.value)}
				type="number"
				value={value}
			/>
			<button
				className="flex size-7 items-center justify-center text-white/60 disabled:opacity-25"
				disabled={!canEdit || quantity >= max}
				onClick={onIncrement}
				type="button"
			>
				<span className="text-sm leading-none">+</span>
			</button>
		</div>
	);
}
