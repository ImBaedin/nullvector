import { describe, expect, it } from "vitest";
import type { Doc } from "../../../_generated/dataModel";

import { compareQueueOrder, queueEventsNextAt } from "../../../../runtime/gameplay/shared";

type QueueRow = {
  _creationTime: number;
  status: "active" | "queued" | "completed" | "cancelled" | "failed";
  order: number;
  queuedAt: number;
  completesAt: number;
};

describe("queue view helpers", () => {
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
        a as unknown as Doc<"colonyQueueItems">,
        b as unknown as Doc<"colonyQueueItems">,
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
      queueEventsNextAt(rows as unknown as Array<Doc<"colonyQueueItems">>),
    ).toBe(900);
  });
});
