import { useCallback, useState } from "react";

export function useBoundedQuantityInput<TKey extends string>(args?: {
	defaultValue?: number;
	max?: number;
	min?: number;
}) {
	const min = args?.min ?? 1;
	const max = args?.max ?? 10_000;
	const defaultValue = args?.defaultValue ?? min;
	const [values, setValues] = useState<Partial<Record<TKey, number>>>({});
	const [inputs, setInputs] = useState<Partial<Record<TKey, string>>>({});

	const updateValue = useCallback((key: TKey, value: number) => {
		setValues((current) => ({ ...current, [key]: value }));
		setInputs((current) => ({ ...current, [key]: String(value) }));
	}, []);

	const decrement = useCallback(
		(key: TKey, currentValue: number) => {
			updateValue(key, Math.max(min, currentValue - 1));
		},
		[min, updateValue],
	);

	const increment = useCallback(
		(key: TKey, currentValue: number) => {
			updateValue(key, Math.min(max, currentValue + 1));
		},
		[max, updateValue],
	);

	const updateInput = useCallback(
		(key: TKey, rawValue: string) => {
			if (!/^\d*$/.test(rawValue)) {
				return;
			}

			setInputs((current) => ({ ...current, [key]: rawValue }));
			if (rawValue === "") {
				return;
			}

			const parsed = Number(rawValue);
			if (!Number.isFinite(parsed)) {
				return;
			}

			setValues((current) => ({
				...current,
				[key]: Math.max(min, Math.min(max, parsed)),
			}));
		},
		[max, min],
	);

	const commitInput = useCallback(
		(key: TKey, currentValue: number) => {
			const rawValue = inputs[key];
			const parsed = Number(rawValue);
			const normalized =
				rawValue && Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : currentValue;
			updateValue(key, normalized);
		},
		[inputs, max, min, updateValue],
	);

	return {
		commitInput,
		decrement,
		increment,
		inputs,
		updateInput,
		updateValue,
		values,
		getInputValue: (key: TKey) => inputs[key] ?? String(values[key] ?? defaultValue),
		getValue: (key: TKey) => values[key] ?? defaultValue,
	};
}
