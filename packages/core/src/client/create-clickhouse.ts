import {
  createClient,
  type ClickHouseClient,
  type ClickHouseClientConfigOptions,
} from "@clickhouse/client";
import type { ClickHouseFacade, TableContext } from "../facade.js";
import { InsertBuffer, type InsertBufferOptions } from "../ingest/buffer.js";
import { buildOrderBy, buildWhere, type WhereClause } from "../read/where.js";
import type { TableHandle } from "../schema/table.js";
import { sqlText, type SqlString } from "../sql.js";
import type { TelemetryHooks } from "../telemetry.js";

export interface CreateClickHouseConfig extends ClickHouseClientConfigOptions {
  telemetry?: TelemetryHooks;
}

function toInsertRow(row: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (row === null || typeof row !== "object") {
    throw new TypeError("insert row must be a plain object");
  }
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (v instanceof Date) {
      out[k] = formatDateTime(v);
    } else if (typeof v === "bigint") {
      out[k] = v.toString();
    } else {
      out[k] = v;
    }
  }
  return out;
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
        ...(queryParams !== undefined && Object.keys(queryParams).length > 0
          ? { query_params: queryParams }
          : {}),
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
        ...(queryParams !== undefined && Object.keys(queryParams).length > 0
          ? { query_params: queryParams }
          : {}),
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
        const { sql: whereSql, params: whereParams } = buildWhere(
          table,
          options?.where as WhereClause<unknown> | undefined
        );
        const orderSql = buildOrderBy(table, options?.orderBy);
        const limit =
          options?.limit !== undefined
            ? `LIMIT ${Number(options.limit)}`
            : "";
        const offset =
          options?.offset !== undefined
            ? `OFFSET ${Number(options.offset)}`
            : "";
        const q = `SELECT * FROM ${table.fullName} ${whereSql} ${orderSql} ${limit} ${offset}`.trim();
        return this.query<TRow[]>(q, whereParams);
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
        const { sql: whereSql, params: whereParams } = buildWhere(
          table,
          options?.where as WhereClause<unknown> | undefined
        );
        const q = `SELECT count() AS c FROM ${table.fullName} ${whereSql}`.trim();
        type Row = { c: string | number | bigint };
        const rows = await this.query<Row[]>(q, whereParams);
        const raw = rows[0]?.c ?? 0;
        return typeof raw === "bigint" ? raw : BigInt(String(raw));
      },

      exists: async (options) => {
        const { sql: whereSql, params: whereParams } = buildWhere(
          table,
          options?.where as WhereClause<unknown> | undefined
        );
        const q = `SELECT 1 AS ok FROM ${table.fullName} ${whereSql} LIMIT 1`.trim();
        type Row = { ok: number };
        const rows = await this.query<Row[]>(q, whereParams);
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
