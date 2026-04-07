# @clickflow/nestjs

NestJS integration for `@clickflow/core`.

## Install

```bash
pnpm add @clickflow/nestjs @clickflow/core @clickhouse/client @nestjs/common @nestjs/core
```

## Register the module

```typescript
import { Module } from "@nestjs/common";
import { ClickHouseModule } from "@clickflow/nestjs";

@Module({
  imports: [
    ClickHouseModule.forRoot({
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
ClickHouseModule.forRootAsync({
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
import { ClickHouseService } from "@clickflow/nestjs";

@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  constructor(private readonly ch: ClickHouseService) {}

  async onModuleDestroy() {
    await this.ch.flushAll();
  }
}
```

Or inject the underlying facade token with `InjectClickHouse()` from this package.

## License

[MPL-2.0](../../LICENSE)
