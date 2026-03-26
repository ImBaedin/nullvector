const QUEST_MODAL_OPEN_EVENT = "nv:quest-modal-open";

export function requestQuestModalOpen(questId?: string) {
	if (typeof window === "undefined") {
		return;
	}
	window.dispatchEvent(
		new CustomEvent<{ questId?: string }>(QUEST_MODAL_OPEN_EVENT, {
			detail: questId ? { questId } : {},
		}),
	);
}

export { QUEST_MODAL_OPEN_EVENT };
