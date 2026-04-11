# ClickFlow proposal: must-have plus Kysely research plan

> **Implementation marker:** ~~Strikethrough~~ marks research/prototype items already covered by the current internal read compiler ([`compile-read.ts`](../../packages/core/src/read/compile-read.ts)).

## Purpose

This document proposes an investigation track for the current must-have roadmap with one extra question:

Can Kysely, used only as an internal utility, accelerate the must-have work in the existing ClickFlow codebase?

The goal is not immediate adoption. The goal is to evaluate whether Kysely reduces implementation cost in the parts that matter most right now.

## Research question

Based on the current ClickFlow implementation, can internal Kysely usage make the must-have roadmap simpler, safer, or faster without distorting the library's API and design?

## Current baseline

Today the codebase already has:

- a small schema DSL
- a read layer with `find`, `first`, `count`, and `exists`
- a basic `where` compiler
- custom DDL generation
- a lightweight migration runner
- insert and buffering helpers

Relevant areas:

- [`column.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/column.ts)
- [`table.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/schema/table.ts)
- [`where.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/read/where.ts)
- [`create-clickhouse.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/client/create-clickhouse.ts)
- [`migrator.ts`](/Users/aaron/Documents/Kerobit/ClickFlow/packages/core/src/migrations/migrator.ts)

This matters because Kysely should be evaluated against real code that already exists, not against an abstract greenfield design.

## Must-have areas to evaluate

### 1. Core type system expansion

Scope:

- `nullable`
- `array`
- `lowCardinality`
- `decimal`
- `datetime64`
- `enum8` / `enum16`

Kysely relevance:

- low

Why:

- this is owned by ClickFlow's schema and insert model, not by a query builder

Research task:

- confirm this area should remain fully native

### 2. Read filters and `select`

Scope:

- richer `where`
- `select`
- possibly the first step toward grouped reads

Kysely relevance:

- high

Why:

- this is the area where manual query assembly will otherwise keep growing

Research task:

- ~~prototype one internal implementation of `find({ select, where, orderBy, limit, offset })` using Kysely~~ (partially done: `find` compiles with Kysely except typed `select` / richer `where`)
- compare it against extending the current compiler directly

### 3. Engine support

Scope:

- `SummingMergeTree`
- `AggregatingMergeTree`
- `Distributed`

Kysely relevance:

- none

Why:

- engine support is ClickHouse DDL territory

Research task:

- exclude Kysely from this workstream

### 4. Migration hardening

Scope:

- checksums
- `dryRun`
- `migrateTo(id)`
- locking

Kysely relevance:

- very low

Why:

- migration semantics here are operational and ClickHouse-specific

Research task:

- treat this as a separate track from any Kysely evaluation

### 5. Runtime validation

Scope:

- insert validation
- ~~optional read validation~~ (`ClickHouseFacade.queryRows` + Zod for JSONEachRow SELECTs)

Kysely relevance:

- none

Why:

- validation belongs to runtime schema handling, not query building

Research task:

- treat this as independent from the Kysely investigation

## Main hypothesis

The likely outcome is:

- Kysely could accelerate only one must-have slice in a meaningful way
- that slice is read/query ergonomics

This is still worth investigating because that slice is important and likely to grow in complexity quickly.

## Research objectives

### Objective 1. Determine implementation payoff

Measure whether Kysely reduces custom code for:

- filter composition — ~~existing `WhereClause` operators compile via Kysely~~; additional operators still mean custom work
- projections (still mostly `SELECT *`)
- ~~ordering~~
- future grouped reads

Success signal:

- fewer hand-built SQL branches in the read layer

### Objective 2. Determine architectural fit

Measure whether Kysely can stay internal without leaking into public APIs.

Success signal:

- external `ClickFlow` read methods remain native and simple

### Objective 3. Determine ClickHouse compatibility risk

Measure whether the common ClickFlow read path compiles cleanly while preserving room for raw SQL and future ClickHouse-specific features.

Success signal:

- no major blocking mismatch in basic reads

## Proposed research phases

### Phase A. Baseline analysis

Goal:

- identify exactly what the current read path already does and where it will grow next

Focus:

- current `WhereClause<T>`
- current `find()` assembly
- `count()` and `exists()` derivation path

Expected output:

- a small list of concrete read features that will likely expand soon

### Phase B. Internal prototype

Goal:

- build a local experiment for read-query compilation using Kysely internally

Suggested prototype scope:

- one table
- ~~`select`~~ (currently `SELECT *` only; column projection still open)
- ~~equality~~
- ~~`in`~~
- `gt` / ~~`gte`~~
- `lt` / ~~`lte`~~
- `neq`
- `isNull`
- `or`
- ~~`orderBy`~~
- ~~`limit`~~
- ~~`offset`~~

Expected output:

- a direct comparison between the current native approach and the Kysely-backed approach

### Phase C. Fit assessment

Goal:

- decide whether the prototype is worth promoting into real implementation work

Decision criteria:

- did it reduce complexity?
- did it stay internal?
- did it avoid shaping the API in awkward ways?
- did it keep the SQL output understandable?

### Phase D. Roadmap decision

Possible outcomes:

- use Kysely internally for reads
- keep a native read compiler
- use a hybrid approach where only some advanced reads use Kysely internally

## Evaluation matrix

### Strong candidates for Kysely-backed implementation

- richer `where`
- `select`
- grouped reads if they are added
- more composable read helpers

### Native-only candidates

- type DSL expansion
- engine support
- DDL generation
- migrations
- runtime validation
- ingest and buffering

## Suggested deliverables

### Deliverable 1. Prototype notes

Document:

- what was easy
- what was awkward
- what required ClickHouse-specific workarounds

### Deliverable 2. Complexity comparison

Compare:

- current native implementation
- projected native extension cost
- Kysely-backed internal approach

### Deliverable 3. Decision memo

State one of:

- adopt Kysely internally for the read layer
- do not adopt Kysely
- defer adoption until read complexity increases further

## Practical recommendation

The must-have roadmap should continue regardless of Kysely.

However, one branch of that roadmap is worth investigating with Kysely:

- read/query ergonomics

Everything else should proceed as native ClickFlow work unless the investigation produces a clearly positive result.

## Final assessment

The must-have roadmap plus a Kysely investigation is a sensible direction if the team stays disciplined about scope.

That means:

- use Kysely only as an internal experiment
- evaluate it only against read/query work
- do not let it redirect the broader architecture

If handled that way, the investigation has upside and limited downside.
