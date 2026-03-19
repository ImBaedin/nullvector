import { useCallback, useState } from "react";

type SaveFn<TKey extends string> = (args: { key: TKey; value: number }) => Promise<void>;

export function useInlineNumberEditor<TKey extends string>(args?: {
	max?: number;
	min?: number;
}) {
	const min = args?.min ?? 0;
	const max = args?.max ?? Number.POSITIVE_INFINITY;
	const [editingKey, setEditingKey] = useState<TKey | null>(null);
	const [draftValue, setDraftValue] = useState("");
	const [savingKey, setSavingKey] = useState<TKey | null>(null);

	const startEditing = useCallback((key: TKey, currentValue: number) => {
		setEditingKey(key);
		setDraftValue(String(currentValue));
	}, []);

	const cancelEditing = useCallback(() => {
		setEditingKey(null);
	}, []);

	const updateDraftValue = useCallback((value: string) => {
		setDraftValue(value.replace(/[^\d]/g, ""));
	}, []);

	const commitEditing = useCallback(
		async (key: TKey, save: SaveFn<TKey>) => {
			const parsed = Math.max(min, Math.min(max, Math.floor(Number(draftValue) || 0)));
			setSavingKey(key);
			try {
				await save({ key, value: parsed });
				setEditingKey(null);
			} finally {
				setSavingKey(null);
			}
		},
		[draftValue, max, min],
	);

	return {
		cancelEditing,
		commitEditing,
		draftValue,
		editingKey,
		isEditing: (key: TKey) => editingKey === key,
		isSaving: (key: TKey) => savingKey === key,
		savingKey,
		setDraftValue: updateDraftValue,
		startEditing,
	};
}
