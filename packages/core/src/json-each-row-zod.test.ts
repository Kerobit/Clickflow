import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonEachRowRows, safeParseJsonEachRowRows } from "./json-each-row-zod.js";

describe("parseJsonEachRowRows", () => {
  const rowSchema = z.object({
    id: z.coerce.number(),
    name: z.string(),
  });

  it("parses a valid row array", () => {
    const rows = parseJsonEachRowRows(
      [
        { id: "1", name: "a" },
        { id: 2, name: "b" },
      ],
      rowSchema
    );
    expect(rows).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
  });

  it("throws on invalid shape", () => {
    expect(() =>
      parseJsonEachRowRows([{ id: 1, name: 2 }], rowSchema)
    ).toThrow();
  });
});

describe("safeParseJsonEachRowRows", () => {
  it("returns error without throwing", () => {
    const rowSchema = z.object({ ok: z.boolean() });
    const res = safeParseJsonEachRowRows([{ ok: "nope" }], rowSchema);
    expect(res.success).toBe(false);
  });
});
