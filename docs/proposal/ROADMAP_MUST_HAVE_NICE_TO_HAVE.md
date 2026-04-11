# ClickFlow proposal: must have and nice to have plan

> **Implementation marker:** ~~Strikethrough~~ marks roadmap lines that are already partially or fully addressed in the repo (not removed so you can see what remains).

## Purpose

This document proposes a practical roadmap for expanding ClickFlow after the current MVP. The goal is to strengthen the main path first: schema definition, read ergonomics, migrations, validation, and production readiness.

The plan is intentionally incremental. ClickFlow should remain SQL-first and OLAP-oriented, not drift into a generic ORM.

## Guiding principles

- Preserve the current SQL-first design and escape hatches.
- Prioritize features that improve daily adoption over broad but shallow coverage.
- Keep advanced features opt-in when they add runtime cost or conceptual weight.
- Avoid large abstractions unless they clearly reduce maintenance cost.

## Must Have

### 1. Core type system expansion

Current table DSL types are too limited for many real ClickHouse schemas.

Proposed additions:

- `nullable(inner)`
- `array(inner)`
- `lowCardinality(inner)`
- `decimal(precision, scale)`
- `datetime64(precision, timezone?)`
- `enum8(values)` / `enum16(values)`

Why this is must-have:

- These types appear early in real analytical schemas.
- Without them, users fall back to raw SQL too quickly.
- They unlock better `where`, insert, and validation support.

Success criteria:

- New types are available in the column DSL.
- Row and insert inference remain correct.
- Insert serialization handles the new types predictably.

### 2. Read filters and query ergonomics

The current `where` support is enough for demos but too narrow for real usage.

Proposed additions:

- Comparison operators: `gt`, `lt`, `neq`
- Range operator: `between`
- Null operators: `isNull`, `isNotNull`
- Text operators where sensible: `like`, `ilike`
- Boolean composition: `or`, `not`
- Column projection via `select`

Why this is must-have:

- Most applications need richer filters before they need a full query builder.
- `select` avoids the cost and awkwardness of `SELECT *`.
- This improves developer experience without hiding SQL semantics.

Success criteria:

- `find` supports selecting a subset of columns.
- `where` remains type-guided and rejects unknown columns.
- The generated SQL stays simple and debuggable.

### 3. More practical engine coverage

The current engine support is too narrow for common ClickHouse table designs.

Proposed additions:

- `SummingMergeTree`
- `AggregatingMergeTree`
- `Distributed`

Why this is must-have:

- These engines cover common analytics and cluster-level usage.
- They reduce the need for raw DDL in first serious deployments.

Success criteria:

- Engine DSL supports the minimum options needed for each engine.
- `toCreateTableSql()` continues to generate explicit and reviewable SQL.

### 4. Production-grade migrations

The migration runner is clean but still light for team and CI usage.

Proposed additions:

- Migration checksums
- `dryRun()`
- `migrateTo(id)`
- Basic locking or coordination protection
- Better applied-state metadata

Why this is must-have:

- Migrations become risky once multiple environments or runners are involved.
- Teams need predictable deploy behavior before they need more DSL breadth.

Success criteria:

- Duplicate runners cannot easily apply the same migration concurrently.
- Drift between migration content and recorded history is visible.
- Operators can inspect what would run before executing it.

### 5. Optional runtime validation

Current type safety is compile-time only.

Proposed additions:

- Optional row validation on insert
- ~~Optional result validation on reads~~ (`queryRows` + Zod)
- Schema adapters that do not become a hard dependency

Why this is must-have:

- Real data pipelines break at runtime, not at compile time.
- Validation is especially useful for ingest-heavy OLAP workloads.

Success criteria:

- Validation can be enabled per table or per operation.
- Runtime validation is optional and does not bloat the default path.

## Nice To Have

### 1. Richer DDL support

Proposed additions:

- `PRIMARY KEY`
- `SAMPLE BY`
- `CODEC`
- Column `DEFAULT`
- Column `MATERIALIZED`
- Column `ALIAS`
- Column and table comments
- Projections

Why it matters:

- This closes the gap between the DSL and hand-written ClickHouse DDL.
- It helps advanced schema definitions remain explicit but ergonomic.

### 2. A small query builder layer

Proposed additions:

- `select`
- `groupBy`
- `having`
- Basic aggregate expressions
- Possibly limited `join` support

Why it matters:

- Many queries are repetitive but still structured enough to benefit from a builder.
- The builder should stay intentionally narrow and keep raw SQL as the escape hatch.

### 3. Better materialized view tooling

Proposed additions:

- Dependency ordering helpers
- View deployment helpers
- Safer creation sequencing for related tables and views

Why it matters:

- MVs are central to many ClickHouse designs.
- Operational friction appears quickly once more than one MV exists.

### 4. Improved ingest path

Proposed additions:

- Higher-throughput insert formats such as `RowBinary`
- Streaming insert helpers
- Retry policies
- Better backpressure handling

Why it matters:

- JSONEachRow is a good baseline but eventually becomes a bottleneck.
- Ingest robustness is a frequent production concern.

### 5. Stronger in-memory buffering

Proposed additions:

- Better overflow policies
- Configurable retries
- More explicit flush strategy controls
- Better observability around queued and dropped rows

Why it matters:

- The current buffer is useful but intentionally simple.
- Production systems often need more control before they need durable queues.

### 6. Wider advanced type support

Proposed additions:

- `Map`
- `Tuple`
- `Nested`
- `JSON` / `Object`
- `IPv4` / `IPv6`
- `FixedString`
- Additional specialized ClickHouse types as needed

Why it matters:

- These types become important once users model richer event payloads and dimensions.
- They are valuable, but they should follow the core type system expansion rather than come first.

### 7. Better framework and operations integrations

Proposed additions:

- OpenTelemetry integration
- NestJS Terminus health checks
- Multi-client and named-client support in NestJS

Why it matters:

- These improve production readiness and framework ergonomics.
- They are important, but not more important than the core schema, query, and migration path.

## Possible addition: Kysely

Kysely is worth evaluating only as a targeted addition, not as a direction change.

Potential role:

- Provide a composable builder for `select`, `where`, `groupBy`, and aggregate-heavy queries.
- Reuse its expression-building model instead of inventing a full builder from scratch.

Potential advantages:

- Faster path to a mature query-building experience.
- Good TypeScript ergonomics.
- Could keep ClickFlow focused on ClickHouse schema, ingest, and migrations.

Risks:

- ClickHouse is not a first-class default target.
- A custom dialect or adapter layer may be required.
- This could pull ClickFlow toward a more general SQL abstraction than intended.

Recommendation:

- ~~Do not adopt Kysely in the first must-have phase.~~ Core already uses an internal Kysely compile path for table reads (`compile-read.ts`); richer filters / column `select` are still open.
- Re-evaluate it after richer filters and `select` support land.
- If adopted, keep it optional and scoped to query composition only.

## Possible addition: OpenTelemetry and Terminus

These fit ClickFlow well as opt-in production integrations.

### OpenTelemetry

Potential role:

- Wrap query, insert, flush, and migration operations in spans.
- Emit standard metrics for latency, errors, row counts, and flush behavior.

Suggested scope:

- Build an adapter on top of existing telemetry hooks first.
- Avoid making OpenTelemetry a hard dependency of `@clickflow/core`.
- Expose a separate package or optional helper if needed.

Recommendation:

- Introduce after migration hardening and validation.
- Start with tracing and basic metrics, not a large observability framework.

### NestJS Terminus

Potential role:

- Expose ClickHouse readiness/liveness checks in NestJS applications.
- Help operators confirm connectivity and basic query health.

Suggested scope:

- Add a small health indicator or helper for `@clickflow/nestjs`.
- Keep it optional and separated from the base service abstraction.

Recommendation:

- Good nice-to-have for the NestJS package once the core package is more production-ready.

## Suggested phases

### Phase 1

- Core type system expansion
- Filter operator expansion
- `select` support
- Migration hardening
- Optional runtime validation design (~~read-side: `queryRows` + Zod on the facade~~; insert-side / peer-dep packaging still open)

Expected outcome:

- ClickFlow becomes viable for materially more real-world schemas and safer deploy workflows.

### Phase 2

- More engines
- Richer DDL
- Better materialized view helpers
- OpenTelemetry integration
- NestJS Terminus support

Expected outcome:

- ClickFlow becomes easier to run in production and better aligned with common ClickHouse patterns.

### Phase 3

- Better ingest formats
- Stronger buffering controls
- Wider advanced type support
- Re-evaluate Kysely as an optional query-builder integration (~~internal compile path already ships~~; public builder / advanced reads still TBD)

Expected outcome:

- ClickFlow improves performance and advanced-use-case coverage without compromising its core model.

## Recommended implementation order

1. Expand core types.
2. Improve `where` and add `select`.
3. Harden migrations.
4. Add optional runtime validation.
5. Add practical engine support.
6. Expand DDL and materialized view tooling.
7. Add observability and NestJS operational helpers.
8. Improve ingest and evaluate optional query-builder integration.

## Summary

The immediate priority should be depth, not breadth. ClickFlow already has a clean MVP shape. The next step is to make the main workflow durable:

- define realistic schemas
- query them with enough ergonomics
- migrate safely
- validate runtime data
- operate the library confidently in production

Everything else should follow from that.
