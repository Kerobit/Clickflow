# ClickFlow architecture

> **Implementation marker:** ~~Strikethrough~~ in the backlog marks items that already have a first cut in code; text without strikethrough is still the active gap.

## Goals

- **OLAP-first**: append-only ingest, analytical queries, MergeTree-family engines, materialized views — not a relational ORM.
- **SQL-first**: raw SQL and generated DDL remain the source of truth; helpers must not hide ClickHouse semantics.
- **Strong typing where it is honest**: row/insert types come from `defineTable` column DSL; arbitrary `query<T>()` requires an explicit `T` chosen by the caller.
- **Escape hatch**: `rawSql`, string queries, and `command()` for DDL/mutations.

## Package layout

- **`@kerobit/clickflow-core`**: `@clickhouse/client` wrapper, telemetry hooks, schema DSL, migrations, buffers, read helpers.
- **`@kerobit/clickflow-nest`**: dynamic module, DI token, service that flushes buffers and closes the client on module destroy.

## Data flow

1. **Queries**: `query()` uses `JSONEachRow` for `SELECT`-style results; `command()` is used for DDL and statements without row JSON.
2. **Inserts**: `insertMany` / `insertOne` map JS values (e.g. `bigint`, `Date`) into shapes suitable for `JSONEachRow`.
3. **Buffers**: `createInsertBuffer` holds rows in memory; flushes on batch size, timer, manual `flush`, or `flushAll()` / shutdown.

## Migrations

- Metadata table (default `_clickflow_migrations`) tracks applied IDs.
- Migrations should prefer **idempotent** DDL (`IF NOT EXISTS`) because ClickHouse offers limited transactional DDL.
- `rollbackLast()` uses `ALTER TABLE ... DELETE` where available; behavior depends on server version and table engine.

## Testing strategy

- **Unit**: SQL/`sql` tag safety, internal read compilation (`compile-read`), DDL snapshots.
- **Integration** (opt-in via `CLICKFLOW_TEST_URL`): create database, table DDL, inserts, reads, migrator, buffer flush.
- **Nest**: `Test.createTestingModule` with provider overrides for the ClickHouse token.

## Backlog (initial)

1. ~~Optional Zod validation path (peer dependency).~~ Read path: `queryRows(..., rowSchema)` + JSONEachRow parsing ([`json-each-row-zod.ts`](../packages/core/src/json-each-row-zod.ts)). Remaining: insert-time validation, optional peer-only packaging (`zod` is currently a direct dependency of core).
2. Minimal `from().select().where()` builder (small surface, always escapable to SQL). *Note:* internal Kysely compilation for table `find` / `count` / `exists` exists ([`compile-read.ts`](../packages/core/src/read/compile-read.ts)); a **public** fluent builder is still backlog.
3. OpenTelemetry adapters on top of `TelemetryHooks`.
4. RowBinary / high-throughput insert path (advanced).
5. MV dependency ordering helpers for migration packs.
