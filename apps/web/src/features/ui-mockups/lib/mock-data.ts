export const colonies = [
  { name: "Aegis Prime", status: "Stable", queue: "Power Plant Lv 7", risk: "Low" },
  { name: "Helion Drift", status: "Overcap Fuel", queue: "Storage Tank Lv 5", risk: "Medium" },
  { name: "Cinder Nest", status: "Raid Watch", queue: "Alloy Mine Lv 9", risk: "High" },
  { name: "Velora Gate", status: "Online", queue: "Shipyard Lv 4", risk: "Low" },
] as const;

export const resources = [
  { name: "Alloy", value: "127.4k", rate: "+412/m", tone: "emerald" },
  { name: "Crystal", value: "82.9k", rate: "+259/m", tone: "sky" },
  { name: "Fuel", value: "41.2k", rate: "+148/m", tone: "amber" },
  { name: "Energy", value: "96%", rate: "Grid Stable", tone: "rose" },
] as const;

export const transports = [
  {
    cargo: "Alloy + Crystal",
    eta: "03:12",
    from: "Aegis Prime",
    route: "G2:S4:SYS8 -> G2:S5:SYS3",
    status: "In Transit",
    to: "Velora Gate",
  },
  {
    cargo: "Fuel",
    eta: "11:44",
    from: "Helion Drift",
    route: "G2:S2:SYS5 -> G2:S5:SYS3",
    status: "Launching",
    to: "Cinder Nest",
  },
  {
    cargo: "Crystal",
    eta: "00:58",
    from: "Velora Gate",
    route: "G1:S8:SYS1 -> G2:S5:SYS3",
    status: "Docking",
    to: "Aegis Prime",
  },
] as const;

export const attacks = [
  { eta: "04:08", source: "Unmarked Fleet", threat: "High", vector: "North Fringe" },
  { eta: "15:31", source: "Rogue Corsair", threat: "Medium", vector: "Core Belt" },
] as const;

export const notifications = [
  { message: "Overflow paused Alloy production on Helion Drift.", time: "2m ago", type: "warning" },
  { message: "Transport NV-118 docked at Velora Gate.", time: "7m ago", type: "success" },
  { message: "Incoming signature detected near Cinder Nest.", time: "11m ago", type: "alert" },
  { message: "Shipyard queue completed on Aegis Prime.", time: "22m ago", type: "info" },
] as const;
