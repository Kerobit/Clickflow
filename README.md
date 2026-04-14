# ClickFlow

[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

**ClickFlow** is the developer-friendly **ClickHouse client** for **TypeScript**. It simplifies high-performance OLAP workloads with typed schemas, robust migrations, and native NestJS integration.

Unlike traditional ORMs, ClickFlow follows a **SQL-first** philosophy. It doesn't attempt to mimic relational primitives (`save`, `update`, `delete`), but instead provides the necessary tools to harness the real power of ClickHouse: typed schemas, robust migrations, and efficient ingestion buffers.

## Key Features

- 🚀 **SQL-first**: Full control over your queries without heavy ORM abstractions.
- 🏗️ **Typed Schemas**: Define tables and materialized views with TypeScript type safety.
- 📦 **Modular Monorepo**: Decoupled packages for the core engine and NestJS integration.
- 🔄 **Migrations**: Built-in system to manage your data schema evolution.
- 📥 **Ingest Buffers**: Optimized for high-volume data insertion.
- 🧩 **NestJS Integration**: Native module for clean and easy dependency injection.

## Packages

| Package | Description |
|--------|-------------|
| [`@kerobit/clickflow-core`](packages/core/README.md) | Core client, safe `sql` templates, `defineTable`, migrations, and read helpers (`find`, `count`, `exists`). |
| [`@kerobit/clickflow-nest`](packages/nestjs/README.md) | NestJS integration via `ClickFlowModule`, dedicated injectors, and services. |

## Development

### Prerequisites

- [pnpm](https://pnpm.io/) (version 9+)
- [Node.js](https://nodejs.org/) (version 20+)

### Useful Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run linters
pnpm lint

# Run unit tests
pnpm test
```

### Integration tests

To run tests against a real ClickHouse instance (via Docker or local):

1. Set the required environment variables:
   - `CLICKFLOW_TEST_URL` (e.g., `http://127.0.0.1:8123`)
   - Optional: `CLICKFLOW_TEST_DATABASE`, `CLICKFLOW_TEST_USER`, `CLICKFLOW_TEST_PASSWORD`.

2. Run the command:
```bash
pnpm test:integration
```

## Documentation

- [Architecture & Design Principles](docs/ARCHITECTURE.md)
- [Core Package Guide](packages/core/README.md)
- [NestJS Integration Guide](packages/nestjs/README.md)

## CI/CD

We use GitHub Actions to ensure code quality through automated build, lint, unit test, and integration test processes against a real ClickHouse instance. See the workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Roadmap

- [ ] Query Builder subset support.
- [ ] Zod integration as a peer dependency for validation.
- [ ] OpenTelemetry support (observability).
- [ ] Richer DDL (TTL, engine settings).
- [ ] Migration rollback hardening.

---

Built with ❤️ by [Kerobit](https://github.com/kerobit).
