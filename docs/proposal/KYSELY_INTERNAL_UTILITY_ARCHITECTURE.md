# ClickFlow proposal: Kysely as an internal utility

> **Implementation marker:** ~~Strikethrough~~ marks items already reflected in code today (see [`compile-read.ts`](../../packages/core/src/read/compile-read.ts)).

## Purpose

This document describes a possible way to use Kysely inside ClickFlow without making it part of the public mental model of the library.

The core idea is simple:

- Kysely is an implementation detail
- ClickFlow stays SQL-first
- ClickFlow keeps owning ClickHouse-specific abstractions
- users are never forced into Kysely concepts

This direction matches a conservative adoption strategy. It gives ClickFlow a way to reuse mature query composition internals without constraining the external API too early.

## Why internal-only is attractive

Using Kysely internally avoids several problems:

- ClickFlow does not become dependent on Kysely as a product identity
- the public API can remain narrow and ClickHouse-oriented
- internal experiments can happen without forcing long-term API commitments
- Kysely can be replaced later if it proves too limiting

This is important because the project still needs freedom to evolve its own schema, engine, migration, and ingest model.

## Recommended boundary

Kysely should be limited to the read/query composition path only.

It should not be used as the foundation for:

- column definitions
- table metadata
- DDL generation
- engine support
- materialized views
- migrations
- inserts
- buffering
- telemetry contracts

Those areas are where ClickFlow's real differentiation lives.

## Best-fit internal use cases

### 1. Building `find()` queries

Kysely could be used internally to compose:

- ~~`select`~~ (`SELECT *` via `selectAll()` today; column projection still future)
- ~~`where`~~ (supported operators still limited by `WhereClause<T>`; compilation is Kysely-backed)
- ~~`orderBy`~~
- ~~`limit`~~
- ~~`offset`~~

~~This would replace most of the current manual string assembly in the read path while keeping the external API owned by ClickFlow.~~ The public API is still ClickFlow-native; the default read path is already compilation-based (with `SELECT *` and literal `LIMIT`/`OFFSET` tails remaining).

### 2. Expanding filter support

Kysely could help support future filter features such as:

- `neq`
- `gt`
- `lt`
- `between`
- `or`
- `not`
- `isNull`
- `isNotNull`
- `like`
- `ilike`

Internally this is much cleaner than growing a custom operator compiler indefinitely.

### 3. Future grouped reads

If ClickFlow later adds grouped reads, Kysely could also back:

- aggregates
- `groupBy`
- `having`
- selected aliases
- expression-based projections

This would be a good reuse of Kysely's mature builder model.

## What the public API should still look like

Even if Kysely is used internally, the public API should remain ClickFlow-native.

Examples:

- `with(table).find({ where, select, orderBy, limit })`
- `with(table).count({ where })`
- `with(table).exists({ where })`

Not recommended:

- exposing Kysely builders directly
- returning Kysely query instances from public methods
- asking users to learn Kysely types to use ClickFlow reads

The reason is simple: once Kysely types leak into the public API, the project becomes harder to evolve independently.

## Possible architecture

### Option A. Internal compiler wrapper

Shape:

- ClickFlow keeps its own `find()` options shape
- an internal adapter translates those options into Kysely builder calls
- the final SQL is compiled and executed through `@clickhouse/client`

Advantages:

- public API stays fully owned by ClickFlow
- easy to replace later
- easiest way to keep SQL-first positioning

Disadvantages:

- ClickFlow still needs its own option model
- some translation code remains necessary

Assessment:

- best default option

### Option B. Internal builder layer hidden behind ClickFlow helpers

Shape:

- ClickFlow builds an internal read DSL
- that DSL is implemented using Kysely behind the scenes

Advantages:

- more room to grow richer read features
- still avoids public Kysely leakage

Disadvantages:

- bigger internal abstraction surface
- more maintenance than Option A

Assessment:

- viable if query composition becomes a larger feature area

### Option C. Public optional Kysely bridge

Shape:

- ClickFlow ships an optional package or helper exposing a Kysely-flavored integration

Advantages:

- power users get more control

Disadvantages:

- increases public surface area
- weakens the internal-only boundary
- creates long-term support pressure

Assessment:

- not recommended at this stage

## Recommended implementation shape

The cleanest design is:

1. keep ClickFlow's public API small and native
2. ~~introduce a private internal adapter for read compilation~~
3. ~~compile to SQL and parameters~~
4. ~~execute through the existing ClickHouse facade~~

This means Kysely would sit between:

- ClickFlow read options
- and the final SQL sent to ClickHouse

It would not sit at the center of the whole architecture.

## What this could improve in the current code

Most likely benefits:

- ~~less manual SQL string concatenation in the read path~~ (reduced for the default table read path; `SELECT *` and tail literals remain)
- easier expansion of filters and projections
- lower maintenance burden for read-query edge cases
- better internal structure for future aggregate queries

This is especially relevant to:

- [`where.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/read/where.ts)
- [`create-clickhouse.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/client/create-clickhouse.ts)

## What still remains fully ClickFlow-owned

Even with internal Kysely usage, ClickFlow still fully owns:

- `defineTable()`
- type DSL and ClickHouse type mapping
- engine modeling
- materialized view modeling
- migration semantics
- insert serialization
- batching and buffering
- telemetry hooks

This is a good thing. Those are the areas where Kysely is not a serious substitute.

## Risks to manage

### 1. Hidden coupling

Even if Kysely is internal, ClickFlow could accidentally start shaping its public API around Kysely constraints.

Mitigation:

- define ClickFlow's public read API first
- use Kysely only as a compiler mechanism

### 2. ClickHouse feature mismatch

Some ClickHouse features may not map naturally to Kysely's assumptions.

Mitigation:

- keep raw SQL as a first-class escape hatch
- avoid forcing all read features through Kysely

### 3. Internal complexity without enough payoff

If ClickFlow only needs `select` plus a few extra operators, Kysely may be heavier than necessary.

Mitigation:

- evaluate it against a small prototype first
- compare against extending the current read layer directly

## Adoption criteria

Kysely should only be kept as an internal dependency if it proves at least one of these:

- it significantly reduces custom read-query code
- it makes must-have query features noticeably easier to add
- it does not distort the public API
- it handles the common ClickFlow query path cleanly

If it fails those criteria, ClickFlow should keep a native implementation.

## Recommendation

Treat Kysely as an internal read-layer utility, not as a foundation.

That means:

- no Kysely in the public API
- no Kysely ownership of schema or DDL concerns
- no assumption that every ClickHouse feature must fit through Kysely

This gives ClickFlow the upside of reuse without giving up control of the library's direction.
