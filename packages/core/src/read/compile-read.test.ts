import { describe, expect, it } from "vitest";
import { string, u64 } from "../column.js";
import { defineTable } from "../schema/table.js";
import {
  compileTableCount,
  compileTableExists,
  compileTableFind,
} from "./compile-read.js";

const t = defineTable("analytics.events", {
  columns: {
    id: u64(),
    kind: string(),
  },
  engine: { name: "MergeTree" },
  orderBy: ["id"],
});

describe("compileTableFind", () => {
  it("builds equality", () => {
    const r = compileTableFind(t, { where: { kind: "signup" } });
    expect(r.sql).toContain("`kind` = {cf_0: String}");
    expect(r.params).toEqual({ cf_0: "signup" });
  });

  it("builds IN with one placeholder per element", () => {
    const r = compileTableFind(t, { where: { kind: { in: ["a", "b"] } } });
    expect(r.sql).toMatch(/`kind` in \(\{cf_0: String\}, \{cf_1: String\}\)/i);
    expect(r.params).toEqual({ cf_0: "a", cf_1: "b" });
  });

  it("builds gte and equality", () => {
    const r = compileTableFind(t, { where: { id: { gte: 1n }, kind: "x" } });
    expect(r.sql).toContain("`id` >= {cf_0: UInt64}");
    expect(r.sql).toContain("`kind` = {cf_1: String}");
    expect(r.params.cf_0).toBe(1n);
    expect(r.params.cf_1).toBe("x");
  });

  it("adds orderBy limit offset", () => {
    const r = compileTableFind(t, {
      where: { kind: "k" },
      orderBy: { id: "desc" },
      limit: 10,
      offset: 5,
    });
    expect(r.sql).toContain("order by `id` desc");
    expect(r.sql).toMatch(/LIMIT 10/);
    expect(r.sql).toMatch(/OFFSET 5/);
  });

  it("rejects unknown where column", () => {
    expect(() =>
      compileTableFind(t, { where: { missing: "x" } as Record<string, string> })
    ).toThrow(/Unknown column in where/);
  });

  it("rejects unknown orderBy column", () => {
    expect(() =>
      compileTableFind(t, { orderBy: { missing: "asc" } })
    ).toThrow(/Unknown column in orderBy/);
  });
});

describe("compileTableCount", () => {
  it("wraps count()", () => {
    const r = compileTableCount(t, { where: { kind: "login" } });
    expect(r.sql.toLowerCase()).toContain("count()");
    expect(r.sql).toContain("`kind` = {cf_0: String}");
  });
});

describe("compileTableExists", () => {
  it("selects literal 1 and LIMIT 1", () => {
    const r = compileTableExists(t, { where: { id: 3n } });
    expect(r.sql).toMatch(/select 1 as `ok`/i);
    expect(r.sql).toMatch(/LIMIT 1$/);
  });
});
