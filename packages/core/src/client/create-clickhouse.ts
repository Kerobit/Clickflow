import {
  createClient,
  type ClickHouseClient,
  type ClickHouseClientConfigOptions,
} from "@clickhouse/client";
import isEmpty from "lodash-es/isEmpty.js";
import mapValues from "lodash-es/mapValues.js";
import type { ZodType } from "zod";
import type { ClickHouseFacade, TableContext } from "../facade.js";
import { InsertBuffer, type InsertBufferOptions } from "../ingest/buffer.js";
import { parseJsonEachRowRows } from "../json-each-row-zod.js";
import {
  compileTableCount,
  compileTableExists,
  compileTableFind,
} from "../read/compile-read.js";
import type { WhereClause } from "../read/where.js";
import type { TableHandle } from "../schema/table.js";
import { sqlText, type SqlString } from "../sql.js";
import type { TelemetryHooks } from "../telemetry.js";

export interface CreateClickHouseConfig extends ClickHouseClientConfigOptions {
  telemetry?: TelemetryHooks;
}

function toInsertRow(row: unknown): Record<string, unknown> {
  if (row === null || typeof row !== "object") {
    throw new TypeError("insert row must be a plain object");
  }
  return mapValues(row as Record<string, unknown>, (v: unknown) => {
    if (v instanceof Date) return formatDateTime(v);
    if (typeof v === "bigint") return v.toString();
    return v;
  });
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

class ClickFlowClient implements ClickHouseFacade {
  private readonly client: ClickHouseClient;
  private readonly telemetry?: TelemetryHooks;
  private readonly buffers = new Set<InsertBuffer<unknown>>();

  constructor(client: ClickHouseClient, telemetry?: TelemetryHooks) {
    this.client = client;
    this.telemetry = telemetry;
  }

  async query<TResult = unknown>(
    queryText: string | SqlString,
    queryParams?: Record<string, unknown>
  ): Promise<TResult> {
    const query = sqlText(queryText);
    this.telemetry?.onQueryStart?.({ query, queryParams });
    const t0 = Date.now();
    try {
      const result = await this.client.query({
        query,
        ...(!isEmpty(queryParams) ? { query_params: queryParams } : {}),
        format: "JSONEachRow",
      });
      const data = (await result.json()) as TResult;
      this.telemetry?.onQueryEnd?.({
        query,
        durationMs: Date.now() - t0,
        success: true,
      });
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.telemetry?.onQueryEnd?.({
        query,
        durationMs: Date.now() - t0,
        success: false,
        error,
      });
      throw error;
    }
  }

  async queryRows<TRow>(
    queryText: string | SqlString,
    rowSchema: ZodType<TRow>,
    queryParams?: Record<string, unknown>
  ): Promise<TRow[]> {
    const raw = await this.query<unknown>(queryText, queryParams);
    return parseJsonEachRowRows(raw, rowSchema);
  }

  async command(
    queryText: string | SqlString,
    queryParams?: Record<string, unknown>
  ): Promise<void> {
    const query = sqlText(queryText);
    this.telemetry?.onQueryStart?.({ query, queryParams });
    const t0 = Date.now();
    try {
      await this.client.command({
        query,
        ...(!isEmpty(queryParams) ? { query_params: queryParams } : {}),
      });
      this.telemetry?.onQueryEnd?.({
        query,
        durationMs: Date.now() - t0,
        success: true,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.telemetry?.onQueryEnd?.({
        query,
        durationMs: Date.now() - t0,
        success: false,
        error,
      });
      throw error;
    }
  }

  with<TRow, TInsert>(table: TableHandle<TRow, TInsert>): TableContext<TRow, TInsert> {
    const telemetry = this.telemetry;
    const ctx: TableContext<TRow, TInsert> = {
      find: async (options) => {
        const { sql: q, params } = compileTableFind(table, {
          where: options?.where as WhereClause<unknown> | undefined,
          orderBy: options?.orderBy,
          limit: options?.limit,
          offset: options?.offset,
        });
        return this.query<TRow[]>(q, params);
      },

      first: async (options) => {
        const rows = await ctx.find({
          where: options?.where,
          orderBy: options?.orderBy,
          limit: 1,
        });
        return rows[0] ?? null;
      },

      count: async (options) => {
        const { sql: q, params } = compileTableCount(table, {
          where: options?.where as WhereClause<unknown> | undefined,
        });
        type Row = { c: string | number | bigint };
        const rows = await this.query<Row[]>(q, params);
        const raw = rows[0]?.c ?? 0;
        return typeof raw === "bigint" ? raw : BigInt(String(raw));
      },

      exists: async (options) => {
        const { sql: q, params } = compileTableExists(table, {
          where: options?.where as WhereClause<unknown> | undefined,
        });
        type Row = { ok: number };
        const rows = await this.query<Row[]>(q, params);
        return rows.length > 0;
      },

      insertOne: async (row) => {
        await this.insertManyInternal(table.fullName, [row]);
      },

      insertMany: async (rows) => {
        await this.insertManyInternal(table.fullName, rows);
      },

      createInsertBuffer: (options: InsertBufferOptions): InsertBuffer<TInsert> => {
        const buf = new InsertBuffer<TInsert>(
          table.fullName,
          async (batch) => {
            await this.insertManyInternal(table.fullName, batch);
          },
          options,
          telemetry
        );
        this.buffers.add(buf as InsertBuffer<unknown>);
        return buf;
      },
    };
    return ctx;
  }

  private async insertManyInternal(
    fullName: string,
    rows: readonly unknown[]
  ): Promise<void> {
    if (rows.length === 0) return;
    const t0 = Date.now();
    try {
      await this.client.insert({
        table: fullName,
        values: rows.map((r) => toInsertRow(r)),
        format: "JSONEachRow",
      });
      this.telemetry?.onInsert?.({
        table: fullName,
        rowCount: rows.length,
        durationMs: Date.now() - t0,
        success: true,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.telemetry?.onInsert?.({
        table: fullName,
        rowCount: rows.length,
        durationMs: Date.now() - t0,
        success: false,
        error,
      });
      throw error;
    }
  }

  async flushAll(): Promise<void> {
    await Promise.all(
      [...this.buffers].map((b) => b.flush("shutdown"))
    );
  }

  async close(): Promise<void> {
    await this.flushAll();
    await this.client.close();
  }
}

export function createClickHouse(config: CreateClickHouseConfig): ClickHouseFacade {
  const { telemetry, ...clientConfig } = config;
  const client = createClient(clientConfig);
  return new ClickFlowClient(client, telemetry);
}
