# @kerobit/clickflow-core

ClickHouse client helpers for **OLAP** workloads: typed table definitions, migrations, buffered inserts, and simple read helpers — without an ORM layer.

## Install

```bash
pnpm add @kerobit/clickflow-core @clickhouse/client
```

## Usage (sketch)

```typescript
import {
  createClickHouse,
  sql,
  defineTable,
  u64,
  string,
  datetime,
} from "@kerobit/clickflow-core";

const ch = createClickHouse({
  url: "http://localhost:8123",
  database: "analytics",
});

type EventRow = { id: string; ts: string; kind: string };

const rows = await ch.query<EventRow[]>(
  sql`SELECT id, ts, kind FROM events WHERE kind = {kind: String} LIMIT {limit: UInt32}`,
  { kind: "signup", limit: 100 }
);

const events = defineTable("analytics.events", {
  columns: {
    id: u64(),
    kind: string(),
    ts: datetime(),
  },
  engine: { name: "MergeTree" },
  orderBy: ["ts", "id"],
});

await ch.with(events).insertMany([
  { id: 1n, kind: "signup", ts: new Date() },
]);

const page = await ch.with(events).find({
  where: { kind: "signup" },
  orderBy: { ts: "desc" },
  limit: 50,
});
```

## API surface (MVP)

- `createClickHouse(config)` — extends official client config + optional `telemetry` hooks.
- `query` / `command` — rows via JSONEachRow for `query`; DDL via `command`.
- `sql` / `rawSql` — tagged template (string fragments only); parameters use ClickHouse named placeholders.
- `defineTable` / `toCreateTableSql` — DDL generation.
- `defineMaterializedView` / `toCreateMaterializedViewSql`.
- `createMigrator({ client, migrations, tableName? })` — `run()`, `pending()`, optional `rollbackLast()`.
- `with(table).find|first|count|exists|insertOne|insertMany|createInsertBuffer`.

## License

[MPL-2.0](../../LICENSE)
