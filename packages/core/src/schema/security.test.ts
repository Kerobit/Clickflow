import { describe, expect, it, vi } from "vitest";
import type { ClickHouseFacade } from "../facade.js";
import { createMigrator } from "../migrations/migrator.js";
import { sql } from "../sql.js";
import { defineMaterializedView } from "./materialized-view.js";

function fakeClient(): ClickHouseFacade {
  return {
    query: vi.fn().mockResolvedValue([]),
    queryRows: vi.fn(),
    command: vi.fn().mockResolvedValue(undefined),
    with: vi.fn(),
    flushAll: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("schema security guards", () => {
  it("rejects invalid migration table names", () => {
    expect(() =>
      createMigrator({
        client: fakeClient(),
        migrations: [],
        tableName: "_clickflow_migrations; DROP TABLE users",
      })
    ).toThrow(/Invalid name segment/);
  });

  it("rejects invalid materialized view order by identifiers", () => {
    const mv = defineMaterializedView("analytics.events_by_day_mv", {
      toTable: "analytics.events_by_day",
      asSelect: sql`SELECT 1 AS day`,
      engine: { name: "MergeTree" },
      orderBy: ["day DESC"],
    });

    expect(() => mv.toCreateMaterializedViewSql()).toThrow(/Invalid identifier/);
  });
});
