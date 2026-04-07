import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { datetime, string, u64 } from "../column.js";
import { createMigrator } from "../migrations/migrator.js";
import { defineTable } from "../schema/table.js";
import { createClickHouse } from "./create-clickhouse.js";

const url = process.env.CLICKFLOW_TEST_URL;

describe.runIf(!!url)("clickhouse integration", () => {
  const database = process.env.CLICKFLOW_TEST_DATABASE ?? "clickflow_it";
  const ch = createClickHouse({
    url: url!,
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
      url: url!,
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
});
