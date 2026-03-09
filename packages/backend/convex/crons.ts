import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"process due fleet operations",
	{ minutes: 1 },
	internal.fleetV2.processDueOperationsCron,
	{},
);

export default crons;
