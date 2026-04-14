# @kerobit/clickflow-core

[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](../../LICENSE)

ClickHouse client helpers for **OLAP** workloads: typed table definitions, migrations, buffered inserts, and simple read helpers — without heavy ORM layers.

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

## API Surface (MVP)

- `createClickHouse(config)` — Extends the official client config + optional telemetry hooks.
- `query` / `command` — Rows via `JSONEachRow` for `query`; DDL via `command`.
- `sql` / `rawSql` — Tagged template for safe SQL fragments; parameters use ClickHouse named placeholders.
- `defineTable` / `toCreateTableSql` — DDL generation.
- `defineMaterializedView` / `toCreateMaterializedViewSql`.
- `createMigrator({ client, migrations, tableName? })` — `run()`, `pending()`, optional rollback.
- `with(table).find|first|count|exists|insertOne|insertMany|createInsertBuffer`.

## License

[MPL-2.0](../../LICENSE)
