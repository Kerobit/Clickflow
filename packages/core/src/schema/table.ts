import isEmpty from "lodash-es/isEmpty.js";
import type { ColumnDef, InferInsert, InferRow } from "../column.js";
import type { EngineSpec } from "./engine.js";
import { engineToSql } from "./engine.js";

export interface ColumnMeta {
  readonly clickHouseType: string;
}

export interface TableHandle<TRow, TInsert = TRow> {
  readonly fullName: string;
  readonly columns: Record<string, ColumnMeta>;
  readonly engine: EngineSpec;
  readonly orderBy: readonly string[];
  readonly partitionBy?: string;
  readonly ttl?: string;
  readonly tableSettings?: Record<string, string | number | boolean>;
  /** Phantom for distinct insert vs row typing */
  readonly _rowInsert?: { row: TRow; insert: TInsert };
  toCreateTableSql(options?: { ifNotExists?: boolean }): string;
}

function quoteIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid column identifier: ${name}`);
  }
  return name;
}

function formatTableName(fullName: string): string {
  const parts = fullName.split(".").map((p) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p)) {
      throw new Error(`Invalid table name segment: ${p}`);
    }
    return p;
  });
  return parts.join(".");
}

export function defineTable<
  const TCols extends Record<string, ColumnDef<unknown>>,
>(
  fullName: string,
  def: {
    columns: TCols;
    engine: EngineSpec;
    orderBy: readonly (keyof TCols & string)[];
    partitionBy?: string;
    ttl?: string;
    tableSettings?: Record<string, string | number | boolean>;
  }
): TableHandle<InferRow<TCols>, InferInsert<TCols>> {
  const columnsMeta: Record<string, ColumnMeta> = {};
  for (const [name, c] of Object.entries(def.columns)) {
    columnsMeta[name] = { clickHouseType: c.clickHouseType };
  }

  const handle: TableHandle<InferRow<TCols>, InferInsert<TCols>> = {
    fullName: formatTableName(fullName),
    columns: columnsMeta,
    engine: def.engine,
    orderBy: def.orderBy as readonly string[],
    partitionBy: def.partitionBy,
    ttl: def.ttl,
    tableSettings: def.tableSettings,
    _rowInsert: undefined,
    toCreateTableSql(options) {
      return buildCreateTableSql(handle, options?.ifNotExists ?? true);
    },
  };

  return handle;
}

function buildCreateTableSql(
  table: TableHandle<unknown, unknown>,
  ifNotExists: boolean
): string {
  const colDefs = Object.entries(table.columns).map(
    ([n, m]) => `${quoteIdent(n)} ${m.clickHouseType}`
  );
  const orderList = table.orderBy.map(quoteIdent).join(", ");
  const engineSql = engineToSql(table.engine);
  let sql = `CREATE TABLE ${ifNotExists ? "IF NOT EXISTS " : ""}${table.fullName} (\n  ${colDefs.join(",\n  ")}\n) ENGINE = ${engineSql}\nORDER BY (${orderList})`;
  if (table.partitionBy) {
    sql += `\nPARTITION BY ${table.partitionBy}`;
  }
  if (table.ttl) {
    sql += `\nTTL ${table.ttl}`;
  }
  if (table.tableSettings && !isEmpty(table.tableSettings)) {
    const pairs = Object.entries(table.tableSettings).map(
      ([k, v]) =>
        `${quoteIdent(k)} = ${
          typeof v === "string"
            ? `'${v.replace(/'/g, "\\'")}'`
            : typeof v === "boolean"
              ? v
                ? "1"
                : "0"
              : String(v)
        }`
    );
    sql += `\nSETTINGS ${pairs.join(", ")}`;
  }
  return sql;
}
