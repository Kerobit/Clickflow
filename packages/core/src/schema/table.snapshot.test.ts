import { describe, expect, it } from "vitest";
import { datetime, string, u64 } from "../column.js";
import { sql } from "../sql.js";
import { defineMaterializedView } from "./materialized-view.js";
import { defineTable } from "./table.js";

describe("DDL snapshots", () => {
  it("defineTable toCreateTableSql", () => {
    const events = defineTable("analytics.events", {
      columns: {
        id: u64(),
        kind: string(),
        ts: datetime(),
      },
      engine: { name: "MergeTree" },
      orderBy: ["ts", "id"],
      partitionBy: "toYYYYMM(ts)",
      ttl: "ts + INTERVAL 180 DAY",
    });
    expect(events.toCreateTableSql()).toMatchSnapshot();
  });

  it("defineMaterializedView toCreateMaterializedViewSql", () => {
    const mv = defineMaterializedView("analytics.events_by_day_mv", {
      toTable: "analytics.events_by_day",
      asSelect: sql`
    SELECT toDate(ts) AS day, kind, count() AS c
    FROM analytics.events
    GROUP BY day, kind
  `,
      engine: { name: "MergeTree" },
      orderBy: ["day", "kind"],
    });
    expect(mv.toCreateMaterializedViewSql()).toMatchSnapshot();
  });
});
