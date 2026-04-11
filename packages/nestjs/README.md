# @kerobit/clickflow-nest

NestJS integration for `@kerobit/clickflow-core`.

## Install

```bash
pnpm add @kerobit/clickflow-nest @kerobit/clickflow-core @clickhouse/client @nestjs/common @nestjs/core
```

## Register the module

```typescript
import { Module } from "@nestjs/common";
import { ClickFlowModule } from "@kerobit/clickflow-nest";

@Module({
  imports: [
    ClickFlowModule.forRoot({
      url: "http://localhost:8123",
      database: "analytics",
      global: true,
    }),
  ],
})
export class AppModule {}
```

Async configuration:

```typescript
ClickFlowModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    url: config.get("CLICKHOUSE_URL"),
    database: config.get("CLICKHOUSE_DB"),
  }),
});
```

## Inject in services

```typescript
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ClickFlowService } from "@kerobit/clickflow-nest";

@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  constructor(private readonly ch: ClickFlowService) {}

  async onModuleDestroy() {
    await this.ch.flushAll();
  }
}
```

Or inject the underlying facade token with `InjectClickFlow()` from this package.

## License

[MPL-2.0](../../LICENSE)
