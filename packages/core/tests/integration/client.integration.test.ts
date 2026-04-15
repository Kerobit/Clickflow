import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { datetime, string, u64 } from "../../src/column.js";
import { createClickHouse } from "../../src/client/create-clickhouse.js";
import { createMigrator } from "../../src/migrations/migrator.js";
import { defineTable } from "../../src/schema/table.js";
import { getClickFlowTestUrl } from "./config.js";

describe("clickhouse integration", () => {
  const url = getClickFlowTestUrl();
  const database = process.env.CLICKFLOW_TEST_DATABASE ?? "clickflow_it";
  const ch = createClickHouse({
    url,
    database,
    username: process.env.CLICKFLOW_TEST_USER,
    password: process.env.CLICKFLOW_TEST_PASSWORD,
  });

  const events = defineTable(`${database}.cf_events`, {
    columns: {
      id: u64(),
      kind: string(),
      ts: datetime(),
    },
    engine: { name: "MergeTree" },
    orderBy: ["ts", "id"],
  });

  beforeAll(async () => {
    const admin = createClickHouse({
      url,
      username: process.env.CLICKFLOW_TEST_USER,
      password: process.env.CLICKFLOW_TEST_PASSWORD,
    });
    await admin.command(`CREATE DATABASE IF NOT EXISTS ${database}`);
    await admin.close();
    await ch.command(events.toCreateTableSql());
  });

  afterAll(async () => {
    await ch.close();
  });

  it("insertMany and find", async () => {
    const ctx = ch.with(events);
    await ctx.insertMany([
      { id: 10n, kind: "signup", ts: new Date("2024-01-15T12:00:00Z") },
      { id: 11n, kind: "login", ts: new Date("2024-01-15T13:00:00Z") },
    ]);
    const rows = await ctx.find({
      where: { kind: "signup" },
      orderBy: { ts: "desc" },
      limit: 10,
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => String(r.id) === "10")).toBe(true);
  });

  it("count and exists", async () => {
    const ctx = ch.with(events);
    const c = await ctx.count({ where: { kind: "login" } });
    expect(c >= 1n).toBe(true);
    expect(await ctx.exists({ where: { id: 11n } })).toBe(true);
  });

  it("first returns a row or null", async () => {
    const ctx = ch.with(events);
    expect(
      await ctx.first({
        where: { id: 999_999_999n },
        orderBy: { ts: "desc" },
      })
    ).toBeNull();
    const one = await ctx.first({
      where: { kind: "signup" },
      orderBy: { ts: "desc" },
    });
    expect(one).not.toBeNull();
    expect(String(one!.id)).toBe("10");
  });

  it("insertOne", async () => {
    const ctx = ch.with(events);
    await ctx.insertOne({
      id: 12n,
      kind: "insert_one",
      ts: new Date("2024-01-16T10:00:00Z"),
    });
    const rows = await ctx.find({ where: { kind: "insert_one" } });
    expect(rows.some((r) => String(r.id) === "12")).toBe(true);
  });

  it("query with query_params", async () => {
    type Row = { v: string };
    const rows = await ch.query<Row[]>(
      "SELECT toString({x:UInt64}) AS v",
      { x: 42n }
    );
    expect(rows[0]?.v).toBe("42");
  });

  it("queryRows validates with zod", async () => {
    const rowSchema = z.object({
      id: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(String(v))),
      kind: z.string(),
    });
    const rows = await ch.queryRows(
      `SELECT id, kind FROM ${events.fullName} WHERE kind = {k:String} ORDER BY ts DESC LIMIT 3`,
      rowSchema,
      { k: "signup" }
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.kind === "signup")).toBe(true);
  });

  it("migrator applies pending", async () => {
    const migrator = createMigrator({
      client: ch,
      tableName: `${database}._clickflow_migrations_it`,
      migrations: [
        {
          id: "001_it_probe",
          up: async ({ exec }) => {
            await exec(`SELECT 1`);
          },
        },
      ],
    });
    await migrator.run();
    const pending = await migrator.pending();
    expect(pending.map((m) => m.id)).toEqual([]);
  });

  it("migrator rollbackLast runs down", async () => {
    const sideTable = `${database}.cf_rb_probe`;
    const migrator = createMigrator({
      client: ch,
      tableName: `${database}._clickflow_migrations_rb`,
      migrations: [
        {
          id: "rb_001_table",
          up: async ({ exec }) => {
            await exec(
              `CREATE TABLE IF NOT EXISTS ${sideTable} (id UInt64) ENGINE = MergeTree ORDER BY id`
            );
          },
          down: async ({ exec }) => {
            await exec(`DROP TABLE IF EXISTS ${sideTable}`);
          },
        },
      ],
    });
    await migrator.run();
    expect((await migrator.pending()).map((m) => m.id)).toEqual([]);
    await migrator.rollbackLast();
    let pendingAfter: string[] = [];
    for (let i = 0; i < 80; i++) {
      pendingAfter = (await migrator.pending()).map((m) => m.id);
      if (pendingAfter.includes("rb_001_table")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(pendingAfter).toContain("rb_001_table");
  });

  it("insert buffer flushes by size", async () => {
    const ctx = ch.with(events);
    const buf = ctx.createInsertBuffer({ maxBatchSize: 2, maxWaitMs: 50_000 });
    buf.enqueue({ id: 100n, kind: "buf", ts: new Date() });
    buf.enqueue({ id: 101n, kind: "buf", ts: new Date() });
    await new Promise((r) => setTimeout(r, 500));
    const found = await ctx.find({ where: { kind: "buf" } });
    expect(found.length).toBeGreaterThanOrEqual(2);
    await buf.flush("manual");
  });

  it("close flushes pending insert buffer", async () => {
    const ch2 = createClickHouse({
      url,
      database,
      username: process.env.CLICKFLOW_TEST_USER,
      password: process.env.CLICKFLOW_TEST_PASSWORD,
    });
    try {
      const ctx = ch2.with(events);
      const buf = ctx.createInsertBuffer({
        maxBatchSize: 100,
        maxWaitMs: 60_000,
      });
      buf.enqueue({
        id: 102n,
        kind: "flush_on_close",
        ts: new Date("2024-02-01T00:00:00Z"),
      });
      await ch2.close();
      const ch3 = createClickHouse({
        url,
        database,
        username: process.env.CLICKFLOW_TEST_USER,
        password: process.env.CLICKFLOW_TEST_PASSWORD,
      });
      try {
        const ctx3 = ch3.with(events);
        const rows = await ctx3.find({ where: { kind: "flush_on_close" } });
        expect(rows.some((r) => String(r.id) === "102")).toBe(true);
      } finally {
        await ch3.close();
      }
    } finally {
      /* ch2 already closed */
    }
  });
});
