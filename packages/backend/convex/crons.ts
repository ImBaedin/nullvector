import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"reconcile all npc raid schedules",
	{ hours: 1 },
	internal.raids.reconcileAllNpcRaidSchedules,
	{},
);

crons.interval("reconcile due npc raids", { minutes: 5 }, internal.raids.reconcileDueNpcRaids, {});

export default crons;
