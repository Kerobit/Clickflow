# ClickFlow architecture

## Goals

- **OLAP-first**: append-only ingest, analytical queries, MergeTree-family engines, materialized views — not a relational ORM.
- **SQL-first**: raw SQL and generated DDL remain the source of truth; helpers must not hide ClickHouse semantics.
- **Strong typing where it is honest**: row/insert types come from `defineTable` column DSL; arbitrary `query<T>()` requires an explicit `T` chosen by the caller.
- **Escape hatch**: `rawSql`, string queries, and `command()` for DDL/mutations.

## Package layout

- **`@clickflow/core`**: `@clickhouse/client` wrapper, telemetry hooks, schema DSL, migrations, buffers, read helpers.
- **`@clickflow/nestjs`**: dynamic module, DI token, service that flushes buffers and closes the client on module destroy.

## Data flow

1. **Queries**: `query()` uses `JSONEachRow` for `SELECT`-style results; `command()` is used for DDL and statements without row JSON.
2. **Inserts**: `insertMany` / `insertOne` map JS values (e.g. `bigint`, `Date`) into shapes suitable for `JSONEachRow`.
3. **Buffers**: `createInsertBuffer` holds rows in memory; flushes on batch size, timer, manual `flush`, or `flushAll()` / shutdown.

## Migrations

- Metadata table (default `_clickflow_migrations`) tracks applied IDs.
- Migrations should prefer **idempotent** DDL (`IF NOT EXISTS`) because ClickHouse offers limited transactional DDL.
- `rollbackLast()` uses `ALTER TABLE ... DELETE` where available; behavior depends on server version and table engine.

## Testing strategy

- **Unit**: SQL/`sql` tag safety, `buildWhere`, DDL snapshots.
- **Integration** (opt-in via `CLICKFLOW_TEST_URL`): create database, table DDL, inserts, reads, migrator, buffer flush.
- **Nest**: `Test.createTestingModule` with provider overrides for the ClickHouse token.

## Backlog (initial)

1. Optional Zod validation path (peer dependency).
2. Minimal `from().select().where()` builder (small surface, always escapable to SQL).
3. OpenTelemetry adapters on top of `TelemetryHooks`.
4. RowBinary / high-throughput insert path (advanced).
5. MV dependency ordering helpers for migration packs.
