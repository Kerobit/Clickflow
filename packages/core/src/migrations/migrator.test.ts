import { describe, expect, it, vi } from "vitest";
import type { ClickHouseFacade } from "../facade.js";
import { createMigrator } from "./migrator.js";

function mockFacade(applied: Set<string>): ClickHouseFacade {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("ORDER BY id DESC LIMIT 1")) {
        const sorted = [...applied].sort();
        const last = sorted[sorted.length - 1];
        return last ? [{ id: last }] : [];
      }
      if (sql.includes("SELECT id FROM")) {
        return [...applied].sort().map((id) => ({ id }));
      }
      return [];
    }),
    command: vi.fn(async (sql: string, params?: Record<string, unknown>) => {
      if (sql.includes("INSERT INTO") && params && "id" in params) {
        applied.add(String(params.id));
      }
      if (sql.includes("ALTER TABLE") && sql.includes("DELETE") && params && "id" in params) {
        applied.delete(String(params.id));
      }
    }),
    queryRows: vi.fn(),
    with: vi.fn(),
    flushAll: vi.fn(),
    close: vi.fn(),
  } as unknown as ClickHouseFacade;
}

describe("createMigrator", () => {
  it("pending lists migrations not yet applied", async () => {
    const applied = new Set<string>();
    const client = mockFacade(applied);
    const migrator = createMigrator({
      client,
      tableName: "default._cf_migrations",
      migrations: [{ id: "a", up: async () => {} }],
    });
    const pending = await migrator.pending();
    expect(pending.map((m) => m.id)).toEqual(["a"]);
  });

  it("run applies migrations in order and is idempotent", async () => {
    const applied = new Set<string>();
    const client = mockFacade(applied);
    const order: string[] = [];
    const migrator = createMigrator({
      client,
      tableName: "default._cf_migrations",
      migrations: [
        {
          id: "m1",
          up: async () => {
            order.push("m1");
          },
        },
        {
          id: "m2",
          up: async () => {
            order.push("m2");
          },
        },
      ],
    });
    const first = await migrator.run();
    expect(first.applied).toEqual(["m1", "m2"]);
    expect(order).toEqual(["m1", "m2"]);
    const second = await migrator.run();
    expect(second.applied).toEqual([]);
    expect(await migrator.pending()).toEqual([]);
  });

  it("rollbackLast runs down and removes last applied id", async () => {
    const applied = new Set<string>();
    const client = mockFacade(applied);
    let downCalled = false;
    const migrator = createMigrator({
      client,
      tableName: "default._cf_migrations",
      migrations: [
        {
          id: "x",
          up: async () => {},
          down: async () => {
            downCalled = true;
          },
        },
      ],
    });
    await migrator.run();
    expect(applied.has("x")).toBe(true);
    await migrator.rollbackLast();
    expect(downCalled).toBe(true);
    expect(applied.has("x")).toBe(false);
  });
});
