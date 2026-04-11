import {
  createClickHouse,
  type CreateClickHouseConfig,
} from "@kerobit/clickflow-core";
import type { DynamicModule, FactoryProvider, ModuleMetadata } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { CLICKFLOW_CLICKHOUSE } from "./clickflow.constants.js";
import { ClickFlowService } from "./clickflow.service.js";

export interface ClickFlowModuleRootOptions extends CreateClickHouseConfig {
  /** Register `ClickFlowModule` globally */
  global?: boolean;
}

export interface ClickFlowModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  global?: boolean;
  inject?: FactoryProvider<CreateClickHouseConfig>["inject"];
  useFactory: FactoryProvider<
    CreateClickHouseConfig | Promise<CreateClickHouseConfig>
  >["useFactory"];
}

@Module({})
export class ClickFlowModule {
  static forRoot(options: ClickFlowModuleRootOptions): DynamicModule {
    const { global, ...config } = options;
    return {
      module: ClickFlowModule,
      global: global ?? false,
      providers: [
        {
          provide: CLICKFLOW_CLICKHOUSE,
          useFactory: () => createClickHouse(config),
        },
        ClickFlowService,
      ],
      exports: [CLICKFLOW_CLICKHOUSE, ClickFlowService],
    };
  }

  static forRootAsync(options: ClickFlowModuleAsyncOptions): DynamicModule {
    return {
      module: ClickFlowModule,
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
        ClickFlowService,
      ],
      exports: [CLICKFLOW_CLICKHOUSE, ClickFlowService],
    };
  }
}
