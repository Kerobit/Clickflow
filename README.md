# ClickFlow

Monorepo (pnpm) for **ClickHouse OLAP** workloads in **TypeScript** with an optional **NestJS** integration. SQL-first: no relational ORM primitives (`save` / `update` / `delete` as core APIs).

## Packages

| Package | Description |
|--------|-------------|
| [`@clickflow/core`](packages/core/README.md) | Client wrapper, typed `query`, `sql` templates, `defineTable` / `defineMaterializedView`, migrations, ingest buffers, read helpers (`find` / `count` / `exists`). |
| [`@clickflow/nestjs`](packages/nestjs/README.md) | `ClickHouseModule.forRoot` / `forRootAsync`, `ClickHouseService`, `InjectClickHouse`. |

## Development

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
```

### Integration tests (Docker / local ClickHouse)

Set `CLICKFLOW_TEST_URL` (e.g. `http://127.0.0.1:8123`). Optional: `CLICKFLOW_TEST_DATABASE`, `CLICKFLOW_TEST_USER`, `CLICKFLOW_TEST_PASSWORD`.

```bash
pnpm test:integration
```

## Documentation

- [Architecture & design principles](docs/ARCHITECTURE.md)

## CI

GitHub Actions runs build, lint, unit tests, and integration tests against ClickHouse (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Roadmap (high level)

Post-MVP: query builder subset, Zod peer, OpenTelemetry, richer DDL (TTL/settings), migration `down` hardening for all ClickHouse versions.
