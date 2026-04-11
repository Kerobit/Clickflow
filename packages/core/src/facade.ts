import type { ZodType } from "zod";
import type { InsertBuffer, InsertBufferOptions } from "./ingest/buffer.js";
import type { TableHandle } from "./schema/table.js";
import type { SqlString } from "./sql.js";
import type { WhereClause } from "./read/where.js";
export interface TableContext<TRow, TInsert> {
  find(options?: {
    where?: WhereClause<TRow>;
    orderBy?: Record<string, "asc" | "desc">;
    limit?: number;
    offset?: number;
  }): Promise<TRow[]>;

  first(options?: {
    where?: WhereClause<TRow>;
    orderBy?: Record<string, "asc" | "desc">;
  }): Promise<TRow | null>;

  count(options?: { where?: WhereClause<TRow> }): Promise<bigint>;

  exists(options?: { where?: WhereClause<TRow> }): Promise<boolean>;

  insertOne(row: TInsert): Promise<void>;

  insertMany(rows: readonly TInsert[]): Promise<void>;

  createInsertBuffer(options: InsertBufferOptions): InsertBuffer<TInsert>;
}

export interface ClickHouseFacade {
  /**
   * Run arbitrary ClickHouse SQL (JSONEachRow). Use this for engine-specific
   * features that typed table helpers do not expose: `FINAL`, `PREWHERE`,
   * `SAMPLE`, complex functions, custom projections, etc. Typed `find` /
   * `count` / `exists` are convenience paths; they are not a replacement for
   * full ClickHouse SQL.
   */
  query<TResult = unknown>(
    queryText: string | SqlString,
    queryParams?: Record<string, unknown>
  ): Promise<TResult>;

  /**
   * Run a SELECT (JSONEachRow), then validate each row with Zod.
   */
  queryRows<TRow>(
    queryText: string | SqlString,
    rowSchema: ZodType<TRow>,
    queryParams?: Record<string, unknown>
  ): Promise<TRow[]>;

  /**
   * Execute SQL without expecting row-shaped JSON (DDL, mutations, settings,
   * etc.). Prefer this (or `query`) when you need ClickHouse-native control
   * beyond the typed read helpers.
   */
  command(
    queryText: string | SqlString,
    queryParams?: Record<string, unknown>
  ): Promise<void>;

  with<TRow, TInsert>(table: TableHandle<TRow, TInsert>): TableContext<TRow, TInsert>;

  /** Flush all insert buffers created via `with(table).createInsertBuffer(...)`. */
  flushAll(): Promise<void>;

  close(): Promise<void>;
}
