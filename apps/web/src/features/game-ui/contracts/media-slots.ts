export type MediaSlot =
  | "alertBackdrop"
  | "buildingCardThumb"
  | "colonyBanner"
  | "researchNodeArt"
  | "shipClassArt";

export type MediaFallback = "gradient" | "icon" | "none";

export type MediaSlotSpec = {
  fallback: MediaFallback;
  minHeight: number;
  minWidth: number;
  ratio: `${number}:${number}`;
  slot: MediaSlot;
};

export const MEDIA_SLOT_SPECS: Record<MediaSlot, MediaSlotSpec> = {
  colonyBanner: {
    slot: "colonyBanner",
    ratio: "21:9",
    minWidth: 640,
    minHeight: 220,
    fallback: "gradient",
  },
  buildingCardThumb: {
    slot: "buildingCardThumb",
    ratio: "4:3",
    minWidth: 240,
    minHeight: 180,
    fallback: "icon",
  },
  shipClassArt: {
    slot: "shipClassArt",
    ratio: "16:9",
    minWidth: 320,
    minHeight: 180,
    fallback: "gradient",
  },
  researchNodeArt: {
    slot: "researchNodeArt",
    ratio: "1:1",
    minWidth: 180,
    minHeight: 180,
    fallback: "icon",
  },
  alertBackdrop: {
    slot: "alertBackdrop",
    ratio: "3:2",
    minWidth: 300,
    minHeight: 200,
    fallback: "gradient",
  },
};
