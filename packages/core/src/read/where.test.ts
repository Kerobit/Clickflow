import { describe, expect, it } from "vitest";
import { string, u64 } from "../column.js";
import { defineTable } from "../schema/table.js";
import { buildWhere } from "./where.js";

const t = defineTable("analytics.events", {
  columns: {
    id: u64(),
    kind: string(),
  },
  engine: { name: "MergeTree" },
  orderBy: ["id"],
});

describe("buildWhere", () => {
  it("returns empty for undefined", () => {
    expect(buildWhere(t, undefined)).toEqual({ sql: "", params: {} });
  });

  it("builds equality", () => {
    const r = buildWhere(t, { kind: "signup" });
    expect(r.sql).toBe("WHERE kind = {cf_0: String}");
    expect(r.params).toEqual({ cf_0: "signup" });
  });

  it("builds IN", () => {
    const r = buildWhere(t, { kind: { in: ["a", "b"] } });
    expect(r.sql).toBe("WHERE kind IN {cf_0: Array(String)}");
    expect(r.params.cf_0).toEqual(["a", "b"]);
  });

  it("builds gte/lte", () => {
    const r = buildWhere(t, { id: { gte: 1n }, kind: "x" });
    expect(r.sql).toContain("id >=");
    expect(r.sql).toContain("kind =");
  });
});
