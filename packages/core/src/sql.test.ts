import { describe, expect, it } from "vitest";
import { rawSql, sql } from "./sql.js";

describe("sql", () => {
  it("joins static template parts", () => {
    const q = sql`SELECT 1`;
    expect(String(q)).toBe("SELECT 1");
  });

  it("allows verified string fragments only", () => {
    const frag = rawSql("LOWER(kind)");
    const q = sql`SELECT ${frag} FROM t`;
    expect(q).toContain("LOWER(kind)");
  });

  it("rejects non-string interpolation", () => {
    expect(() => sql`SELECT ${1}`).toThrow(/only string fragments/);
  });
});
