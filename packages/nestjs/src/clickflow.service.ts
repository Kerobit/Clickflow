import type {
  ClickHouseFacade,
  TableContext,
  TableHandle,
} from "@kerobit/clickflow-core";
import type { ZodType } from "zod";
import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { CLICKFLOW_CLICKHOUSE } from "./clickflow.constants.js";

@Injectable()
export class ClickFlowService implements OnModuleDestroy {
  constructor(
    @Inject(CLICKFLOW_CLICKHOUSE) private readonly client: ClickHouseFacade
  ) {}

  query<TResult = unknown>(
    queryText: Parameters<ClickHouseFacade["query"]>[0],
    queryParams?: Record<string, unknown>
  ): Promise<TResult> {
    return this.client.query(queryText, queryParams);
  }

  queryRows<TRow>(
    queryText: Parameters<ClickHouseFacade["query"]>[0],
    rowSchema: ZodType<TRow>,
    queryParams?: Record<string, unknown>
  ): Promise<TRow[]> {
    return this.client.queryRows<TRow>(queryText, rowSchema, queryParams);
  }

  command(
    queryText: Parameters<ClickHouseFacade["command"]>[0],
    queryParams?: Record<string, unknown>
  ): Promise<void> {
    return this.client.command(queryText, queryParams);
  }

  with<TRow, TInsert>(
    table: TableHandle<TRow, TInsert>
  ): TableContext<TRow, TInsert> {
    return this.client.with(table);
  }

  flushAll(): Promise<void> {
    return this.client.flushAll();
  }

  close(): Promise<void> {
    return this.client.close();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.flushAll();
    await this.client.close();
  }
}
