import { describe, expect, it } from "vitest";
import type { Doc } from "../../../_generated/dataModel";

import {
  buildLaneQueueView,
  compareQueueOrder,
  getBuildingLaneCapacity,
  queueEventsNextAt,
} from "../../../../runtime/gameplay/shared";

type QueueRow = {
  _creationTime: number;
  status: "active" | "queued" | "completed" | "cancelled" | "failed";
  order: number;
  queuedAt: number;
  completesAt: number;
};

describe("queue view helpers", () => {
  it("computes building lane capacity from robotics hub level", () => {
    const levels = [0, 1, 2, 3, 4, 5, 6];
    const capacities = levels.map((roboticsHubLevel) =>
      getBuildingLaneCapacity({
        buildings: {
          alloyMineLevel: 1,
          crystalMineLevel: 1,
          fuelRefineryLevel: 1,
          powerPlantLevel: 1,
          alloyStorageLevel: 1,
          crystalStorageLevel: 1,
          fuelStorageLevel: 1,
          roboticsHubLevel,
          shipyardLevel: 0,
        },
      }),
    );

    expect(capacities).toEqual([2, 2, 3, 3, 4, 4, 5]);
  });

  it("orders by order then queuedAt then creationTime", () => {
    const rows: QueueRow[] = [
      {
        _creationTime: 20,
        status: "queued",
        order: 2,
        queuedAt: 200,
        completesAt: 2000,
      },
      {
        _creationTime: 30,
        status: "queued",
        order: 1,
        queuedAt: 300,
        completesAt: 3000,
      },
      {
        _creationTime: 10,
        status: "queued",
        order: 1,
        queuedAt: 200,
        completesAt: 2500,
      },
    ];

    const sorted = [...rows].sort((a, b) =>
      compareQueueOrder(
        a as unknown as Doc<"colonyQueueItems"> & {
          cost: { alloy: number; crystal: number; fuel: number };
          payload: any;
        },
        b as unknown as Doc<"colonyQueueItems"> & {
          cost: { alloy: number; crystal: number; fuel: number };
          payload: any;
        },
      ),
    );

    expect(sorted[0]).toMatchObject({ order: 1, queuedAt: 200, _creationTime: 10 });
    expect(sorted[1]).toMatchObject({ order: 1, queuedAt: 300, _creationTime: 30 });
    expect(sorted[2]).toMatchObject({ order: 2, queuedAt: 200, _creationTime: 20 });
  });

  it("returns earliest completion among open statuses", () => {
    const rows: QueueRow[] = [
      {
        _creationTime: 1,
        status: "completed",
        order: 1,
        queuedAt: 10,
        completesAt: 500,
      },
      {
        _creationTime: 2,
        status: "queued",
        order: 2,
        queuedAt: 20,
        completesAt: 1200,
      },
      {
        _creationTime: 3,
        status: "active",
        order: 3,
        queuedAt: 30,
        completesAt: 900,
      },
    ];

    expect(
      queueEventsNextAt(
        rows as unknown as Array<
          Doc<"colonyQueueItems"> & {
            cost: { alloy: number; crystal: number; fuel: number };
            payload: any;
          }
        >,
      ),
    ).toBe(900);
  });

  it("uses provided lane maxItems override for fullness", () => {
    const now = 1_000;
    const rows = [
      {
        _id: "row_1",
        _creationTime: 1,
        universeId: "u",
        playerId: "p",
        colonyId: "c",
        lane: "building",
        kind: "buildingUpgrade",
        status: "active",
        order: 1,
        queuedAt: 10,
        startsAt: 10,
        completesAt: 2_000,
        createdAt: 10,
        updatedAt: 10,
        cost: { alloy: 0, crystal: 0, fuel: 0 },
        payload: { buildingKey: "alloyMineLevel", fromLevel: 1, toLevel: 2 },
      },
      {
        _id: "row_2",
        _creationTime: 2,
        universeId: "u",
        playerId: "p",
        colonyId: "c",
        lane: "building",
        kind: "buildingUpgrade",
        status: "queued",
        order: 2,
        queuedAt: 20,
        startsAt: 20,
        completesAt: 3_000,
        createdAt: 20,
        updatedAt: 20,
        cost: { alloy: 0, crystal: 0, fuel: 0 },
        payload: { buildingKey: "crystalMineLevel", fromLevel: 1, toLevel: 2 },
      },
    ] as unknown as Array<
      Doc<"colonyQueueItems"> & {
        cost: { alloy: number; crystal: number; fuel: number };
        payload: any;
      }
    >;

    const view = buildLaneQueueView({
      lane: "building",
      maxItems: 2,
      now,
      rows,
    });

    expect(view.maxItems).toBe(2);
    expect(view.totalItems).toBe(2);
    expect(view.isFull).toBe(true);
  });
});
