import {
  createClickHouse,
  type CreateClickHouseConfig,
} from "@clickflow/core";
import type { DynamicModule, FactoryProvider, ModuleMetadata } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { CLICKFLOW_CLICKHOUSE } from "./clickhouse.constants.js";
import { ClickHouseService } from "./clickhouse.service.js";

export interface ClickHouseModuleRootOptions extends CreateClickHouseConfig {
  /** Register `ClickHouseModule` globally */
  global?: boolean;
}

export interface ClickHouseModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  global?: boolean;
  inject?: FactoryProvider<CreateClickHouseConfig>["inject"];
  useFactory: FactoryProvider<
    CreateClickHouseConfig | Promise<CreateClickHouseConfig>
  >["useFactory"];
}

@Module({})
export class ClickHouseModule {
  static forRoot(options: ClickHouseModuleRootOptions): DynamicModule {
    const { global, ...config } = options;
    return {
      module: ClickHouseModule,
      global: global ?? false,
      providers: [
        {
          provide: CLICKFLOW_CLICKHOUSE,
          useFactory: () => createClickHouse(config),
        },
        ClickHouseService,
      ],
      exports: [CLICKFLOW_CLICKHOUSE, ClickHouseService],
    };
  }

  static forRootAsync(options: ClickHouseModuleAsyncOptions): DynamicModule {
    return {
      module: ClickHouseModule,
      global: options.global ?? false,
      imports: options.imports,
      providers: [
        {
          provide: CLICKFLOW_CLICKHOUSE,
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) => {
            const cfg = await options.useFactory(...(args as never[]));
            return createClickHouse(cfg);
          },
        },
        ClickHouseService,
      ],
      exports: [CLICKFLOW_CLICKHOUSE, ClickHouseService],
    };
  }
}
