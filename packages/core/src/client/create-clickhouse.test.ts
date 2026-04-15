import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { u64 } from "../column.js";
import { defineTable } from "../schema/table.js";

const mockQuery = vi.fn();
const mockCommand = vi.fn();
const mockInsert = vi.fn();
const mockClose = vi.fn();

vi.mock("@clickhouse/client", () => ({
  createClient: vi.fn(() => ({
    query: (...args: unknown[]) => mockQuery(...args),
    command: (...args: unknown[]) => mockCommand(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    close: (...args: unknown[]) => mockClose(...args),
  })),
}));

import { createClickHouse } from "./create-clickhouse.js";

describe("createClickHouse", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockCommand.mockReset();
    mockInsert.mockReset();
    mockClose.mockReset();
    mockQuery.mockResolvedValue({ json: () => Promise.resolve([]) });
    mockCommand.mockResolvedValue(undefined);
    mockInsert.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
  });

  it("query reports telemetry on success", async () => {
    const onQueryStart = vi.fn();
    const onQueryEnd = vi.fn();
    mockQuery.mockResolvedValue({ json: () => Promise.resolve([{ c: 1 }]) });
    const ch = createClickHouse({
      url: "http://127.0.0.1:39487",
      telemetry: { onQueryStart, onQueryEnd },
    });
    await ch.query("SELECT 1");
    expect(onQueryStart).toHaveBeenCalledWith(
      expect.objectContaining({ query: "SELECT 1" })
    );
    expect(onQueryEnd).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, query: "SELECT 1" })
    );
    await ch.close();
  });

  it("query reports telemetry on failure", async () => {
    const onQueryEnd = vi.fn();
    mockQuery.mockRejectedValue(new Error("network"));
    const ch = createClickHouse({
      url: "http://127.0.0.1:39487",
      telemetry: { onQueryEnd },
    });
    await expect(ch.query("SELECT boom")).rejects.toThrow("network");
    expect(onQueryEnd).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.any(Error) })
    );
    await ch.close();
  });

  it("queryRows parses rows with zod", async () => {
    mockQuery.mockResolvedValue({
      json: () => Promise.resolve([{ id: "1", name: "a" }]),
    });
    const ch = createClickHouse({ url: "http://127.0.0.1:39487" });
    const schema = z.object({ id: z.string(), name: z.string() });
    const rows = await ch.queryRows("SELECT 1", schema);
    expect(rows).toEqual([{ id: "1", name: "a" }]);
    await ch.close();
  });

  it("command reports telemetry on success and error", async () => {
    const onQueryEnd = vi.fn();
    const ch = createClickHouse({
      url: "http://127.0.0.1:39487",
      telemetry: { onQueryEnd },
    });
    await ch.command("OPTIMIZE TABLE t");
    expect(onQueryEnd).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    mockCommand.mockRejectedValueOnce(new Error("cmd fail"));
    await expect(ch.command("BAD")).rejects.toThrow("cmd fail");
    expect(onQueryEnd).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    await ch.close();
  });

  it("insertMany reports telemetry on insert failure", async () => {
    const onInsert = vi.fn();
    mockInsert.mockRejectedValue(new Error("insert failed"));
    const ch = createClickHouse({
      url: "http://127.0.0.1:39487",
      telemetry: { onInsert },
    });
    const t = defineTable("db.t", {
      columns: { id: u64() },
      engine: { name: "MergeTree" },
      orderBy: ["id"],
    });
    const ctx = ch.with(t);
    await expect(ctx.insertMany([{ id: 1n }])).rejects.toThrow("insert failed");
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, rowCount: 1 })
    );
    await ch.close();
  });
});
