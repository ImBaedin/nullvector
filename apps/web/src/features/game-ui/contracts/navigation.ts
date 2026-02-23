export type ContextNavId =
  | "defenses"
  | "facilities"
  | "fleet"
  | "overview"
  | "resources"
  | "shipyard";

export type ContextNavItem = {
  badgeCount?: number;
  icon?: React.ReactNode;
  id: ContextNavId;
  isDisabled?: boolean;
  label: string;
  to: string;
};

export type ColonyOption = {
  addressLabel?: string;
  details?: string;
  id: string;
  imageUrl?: string;
  isFavorite?: boolean;
  name: string;
  status?: string;
};

export type ResourceDatum = {
  deltaPerMinuteAmount?: number;
  deltaPerMinute?: string;
  energyBalance?: number;
  key: "alloy" | "crystal" | "energy" | "fuel";
  storageCapAmount?: number;
  storageCapLabel?: string;
  storageCurrentAmount?: number;
  storageCurrentLabel?: string;
  storagePercent?: number;
  tone?: "danger" | "neutral" | "positive" | "warning";
  valueAmount?: number;
  value: string;
};

export type AlertDatum = {
  id: string;
  message: string;
  severity: "danger" | "info" | "warning";
};
