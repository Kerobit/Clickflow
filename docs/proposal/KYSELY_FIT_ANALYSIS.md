# ClickFlow proposal: where Kysely could help with the current implementation

> **Implementation marker:** ~~Strikethrough~~ marks wording that described the codebase *before* internal read compilation landed; it is kept for history. Current read compilation lives in [`compile-read.ts`](../../packages/core/src/read/compile-read.ts) (Kysely compile-only + `ClickHouseFacade` execution).

## Purpose

This document evaluates a narrower question than the roadmap:

What parts of ClickFlow that already exist today could be covered, simplified, or improved by introducing Kysely?

The goal is not to justify adopting Kysely everywhere. The goal is to identify where it could reduce custom code and where it would add little value.

## Short answer

Kysely could help mainly in the read/query composition layer.

It could improve:

- query building
- filter composition
- column selection
- grouping and aggregate query ergonomics
- joins if ClickFlow ever wants to support them

It would not seriously help with:

- ClickHouse schema DSL
- engine-specific DDL
- materialized view DDL
- ingest paths
- buffering
- most migration semantics specific to ClickHouse

## Current ClickFlow areas and possible Kysely impact

### 1. `where` builder

Current state:

- ClickFlow has a custom `WhereClause<T>` model and `buildWhere()` helper.
- It currently supports equality, `IN`, `gte`, and `lte`.

Relevant code:

- [`where.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/read/where.ts)

Where Kysely could help:

- Provide a more complete expression model instead of growing a custom operator tree.
- Make `or`, `not`, nested conditions, aliases, expressions, and computed predicates easier to express.
- Reduce the amount of hand-built SQL string logic in the read layer.

Code improvement potential:

- Replace or wrap `buildWhere()` with a typed expression builder.
- Avoid a steadily growing switchboard of custom operators in ClickFlow code.
- Make future support for `like`, `between`, `is null`, aggregate filters, and reusable predicates easier.

What Kysely would not solve here:

- Mapping ClickFlow table metadata into ClickHouse-specific type semantics.
- Runtime validation of parameter values.

Conclusion:

- This is one of the strongest Kysely fit areas.

### 2. `find()` and read composition

Current state:

- ~~`find()` builds SQL manually~~ `find()` compiles through internal Kysely (`compileTableFind`) and still always emits `SELECT *`.
- ~~Ordering and pagination are also assembled with custom string logic.~~ `orderBy` is compiled via Kysely; `LIMIT` / `OFFSET` are still appended as literal tails (see `appendLimitOffset`).

Relevant code:

- [`compile-read.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/read/compile-read.ts)
- [`create-clickhouse.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/client/create-clickhouse.ts)

Where Kysely could help:

- Build `select` statements in a more composable and type-aware way.
- Add column projection cleanly.
- Make future `groupBy`, `having`, `join`, aliases, derived selections, and expression reuse much easier.

Code improvement potential:

- ~~Simplify the current manual assembly of `SELECT`, `WHERE`, `ORDER BY`, `LIMIT`, and `OFFSET`.~~ Much of this is already internal Kysely; remaining gaps are `SELECT *`, richer `WHERE`, and ClickHouse-specific clauses.
- Reduce the chance that ClickFlow accumulates many small query builder edge cases.
- Make query logic easier to test at the expression level.

What Kysely would not solve here:

- ClickHouse execution semantics such as `FINAL`, `PREWHERE`, `SAMPLE`, or engine-aware read behavior unless ClickFlow adds explicit support.
- Output parsing from the ClickHouse client.

Conclusion:

- This is the single best area where Kysely could materially improve the codebase.

### 3. A future query builder API

Current state:

- ClickFlow is SQL-first and does not yet expose a real query builder.
- The roadmap already points toward a small builder subset.

Where Kysely could help:

- Provide the underlying builder model rather than forcing ClickFlow to invent one.
- Let ClickFlow expose a thin, opinionated layer on top instead of building a full API surface alone.

Code improvement potential:

- Faster path to a robust typed builder.
- Less maintenance burden around AST-like query composition.
- Better support for advanced selects and aggregations than a bespoke MVP builder.

Main risk:

- ClickFlow may start to inherit Kysely concepts more than ClickHouse concepts.

Conclusion:

- Strong fit if ClickFlow decides query composition is a serious feature, not just a convenience helper.

### 4. Ordering and selected-column safety

Current state:

- `buildOrderBy()` validates column names against known metadata and assembles SQL strings.

Relevant code:

- [`where.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/read/where.ts)

Where Kysely could help:

- Model selected columns and references more naturally.
- Reduce the amount of manual field-name validation needed for read queries.

Code improvement potential:

- Cleaner typing for selected columns and derived fields.
- Better long-term ergonomics once reads become more than table scans with filters.

Limit:

- This benefit is tied to adopting Kysely for the larger read path. It is not worth adopting Kysely only for `ORDER BY`.

Conclusion:

- Helpful, but secondary to the main `find()` and `where` gains.

### 5. Raw SQL escape hatch

Current state:

- ClickFlow already has `sql`, `rawSql`, and `query()` / `command()`.

Relevant code:

- [`sql.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/sql.ts)
- [`facade.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/facade.ts)

Where Kysely could help:

- Mostly by coexisting with raw SQL, not by replacing it.

Code improvement potential:

- Kysely could become an optional path for structured reads while raw SQL remains the escape hatch.

What Kysely would not improve much:

- The current `sql` tag is already simple and fits the SQL-first design.
- There is little custom complexity here to remove.

Conclusion:

- Little direct benefit. Keep the current raw SQL path even if Kysely is introduced.

### 6. Table definitions and type inference

Current state:

- ClickFlow defines its own column DSL and row/insert inference.

Relevant code:

- [`column.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/column.ts)
- [`table.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/schema/table.ts)

Where Kysely could help:

- Very little directly.

What Kysely would not solve:

- ClickHouse-specific types
- engine definitions
- DDL generation
- insert serialization rules
- table metadata for materialized views and engines

Conclusion:

- This should remain native ClickFlow code.

### 7. Engine support and DDL generation

Current state:

- ClickFlow owns engine modeling and `CREATE TABLE` SQL generation.

Relevant code:

- [`engine.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/schema/engine.ts)
- [`table.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/schema/table.ts)
- [`materialized-view.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/schema/materialized-view.ts)

Where Kysely could help:

- Almost nowhere in a meaningful way.

What Kysely would not solve:

- MergeTree-family engines
- `ORDER BY`, `PARTITION BY`, TTL, settings
- materialized views
- ClickHouse-specific DDL features

Conclusion:

- Kysely is not a useful abstraction for this part of the codebase.

### 8. Migrations

Current state:

- ClickFlow has a lightweight migration runner with `pending()`, `run()`, and `rollbackLast()`.

Relevant code:

- [`migrator.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/migrations/migrator.ts)

Where Kysely could help:

- Only indirectly if ClickFlow wanted to borrow ideas for migration execution shape.

What Kysely would not solve:

- ClickHouse operational semantics
- idempotent DDL strategy
- metadata tracking policy
- locking strategy
- rollback behavior

Conclusion:

- Kysely is not a serious accelerator for this part. Another migration-focused tool would help more than Kysely.

### 9. Inserts, buffering, and ingest

Current state:

- ClickFlow handles inserts through the official ClickHouse client.
- It also provides an in-memory insert buffer.

Relevant code:

- [`create-clickhouse.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/client/create-clickhouse.ts)
- [`buffer.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/ingest/buffer.ts)

Where Kysely could help:

- Nowhere meaningful.

What Kysely would not solve:

- `JSONEachRow` vs `RowBinary`
- retries and backpressure
- streaming inserts
- buffer durability
- serialization for ClickHouse-specific types

Conclusion:

- No serious Kysely value here.

## What Kysely could let ClickFlow delete or simplify

If ClickFlow adopts Kysely for the read layer, these are the most likely simplifications:

- ~~reduce custom SQL string assembly for reads~~ (partially realized for the main table-scan path)
- reduce growth pressure on `WhereClause<T>`
- avoid building a custom expression tree for filters and projections
- make advanced read features cheaper to add later

This does not mean removing all custom code. ClickFlow would still need:

- mapping from `defineTable()` metadata into Kysely-friendly schema references
- ClickHouse execution through `@clickhouse/client`
- raw SQL support
- ClickHouse-specific query extensions that Kysely does not model natively

## What Kysely could make worse

These are the main costs and risks:

- adapter complexity for ClickHouse
- introducing a second abstraction model into a project that is currently very direct
- pushing users toward generic SQL builder patterns instead of ClickHouse-first thinking
- tighter coupling to Kysely internals if a custom dialect becomes necessary

This matters because ClickFlow's value is not just typing. Its value is being explicit about ClickHouse.

## Recommended integration shape if adopted

If Kysely is introduced, the cleanest shape would be:

- keep schema, DDL, engines, MVs, migrations, ingest, and buffering as native ClickFlow features
- use Kysely only inside the read/query composition layer (today: `find` / `count` / `exists` already compile internally)
- preserve `query()` and `command()` as first-class escape hatches
- expose Kysely-backed APIs as optional or additive, not as a replacement for SQL-first usage

## Practical recommendation

Kysely is worth evaluating if the team decides that read/query ergonomics are now a major product goal.

It is not worth adopting to solve the broader ClickFlow roadmap.

The strongest reason to add it would be this:

- avoid spending a lot of engineering time building and maintaining a custom typed read builder

The strongest reason not to add it would be this:

- most of ClickFlow's hard problems are not query-builder problems

## Final assessment

Serious Kysely fit:

- `where`
- `find`
- `select`
- future grouped and joined reads
- typed query composition in general

Weak Kysely fit:

- schema DSL
- DDL
- engines
- materialized views
- migrations
- inserts
- buffering
- operational features

In short: Kysely could improve an important slice of the codebase, but only one slice. It is a focused accelerator for reads, not a foundation for the whole project.
