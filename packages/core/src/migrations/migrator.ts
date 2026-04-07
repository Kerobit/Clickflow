import type { ClickHouseFacade } from "../facade.js";

export interface Migration {
  readonly id: string;
  up: (ctx: MigrationContext) => Promise<void>;
  down?: (ctx: MigrationContext) => Promise<void>;
}

export interface MigrationContext {
  /** Run arbitrary SQL (DDL/DML). Prefer idempotent statements where possible. */
  exec(sql: string, queryParams?: Record<string, unknown>): Promise<void>;
}

const DEFAULT_TABLE = "_clickflow_migrations";

export interface MigratorOptions {
  client: ClickHouseFacade;
  migrations: readonly Migration[];
  tableName?: string;
}

export function createMigrator(options: MigratorOptions) {
  const tableName = options.tableName ?? DEFAULT_TABLE;
  const { client } = options;
  const migrations = [...options.migrations].sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  async function ensureMetaTable(): Promise<void> {
    await client.command(`
CREATE TABLE IF NOT EXISTS ${tableName}
(
  id String,
  applied_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY id
`);
  }

  async function listApplied(): Promise<Set<string>> {
    type Row = { id: string };
    const rows = await client.query<Row[]>(
      `SELECT id FROM ${tableName} ORDER BY id`
    );
    return new Set(rows.map((r) => r.id));
  }

  return {
    async pending(): Promise<Migration[]> {
      await ensureMetaTable();
      const applied = await listApplied();
      return migrations.filter((m) => !applied.has(m.id));
    },

    async run(): Promise<{ applied: string[] }> {
      await ensureMetaTable();
      const applied = await listApplied();
      const newly: string[] = [];
      const ctx: MigrationContext = {
        exec: (sql, queryParams) => client.command(sql, queryParams),
      };
      for (const m of migrations) {
        if (applied.has(m.id)) continue;
        await m.up(ctx);
        await client.command(
          `INSERT INTO ${tableName} (id) VALUES ({id: String})`,
          { id: m.id }
        );
        newly.push(m.id);
        applied.add(m.id);
      }
      return { applied: newly };
    },

    async rollbackLast(): Promise<void> {
      await ensureMetaTable();
      const rows = await client.query<{ id: string }[]>(
        `SELECT id FROM ${tableName} ORDER BY id DESC LIMIT 1`,
        {}
      );
      const last = rows[0];
      if (!last) return;
      const m = migrations.find((x) => x.id === last.id);
      if (!m?.down) {
        throw new Error(`Migration ${last.id} has no down()`);
      }
      const ctx: MigrationContext = {
        exec: (sql, queryParams) => client.command(sql, queryParams),
      };
      await m.down(ctx);
      await client.command(
        `ALTER TABLE ${tableName} DELETE WHERE id = {id: String}`,
        { id: last.id }
      );
    },
  };
}
