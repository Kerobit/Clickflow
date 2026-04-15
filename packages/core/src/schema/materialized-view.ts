import type { SqlString } from "../sql.js";
import { sqlText } from "../sql.js";
import type { EngineSpec } from "./engine.js";
import { engineToSql } from "./engine.js";
import { formatIdentifierList, formatQualifiedName } from "./identifiers.js";

export interface MaterializedViewHandle {
  readonly fullName: string;
  readonly toTable: string;
  readonly asSelect: SqlString;
  readonly engine?: EngineSpec;
  readonly orderBy?: readonly string[];
  readonly populate: boolean;
  toCreateMaterializedViewSql(options?: { ifNotExists?: boolean }): string;
}

export function defineMaterializedView(
  fullName: string,
  def: {
    toTable: string;
    asSelect: SqlString;
    engine?: EngineSpec;
    orderBy?: readonly string[];
    populate?: boolean;
  }
): MaterializedViewHandle {
  const handle: MaterializedViewHandle = {
    fullName: formatQualifiedName(fullName),
    toTable: formatQualifiedName(def.toTable),
    asSelect: def.asSelect,
    engine: def.engine,
    orderBy: def.orderBy,
    populate: def.populate ?? false,
    toCreateMaterializedViewSql(options) {
      const ifNot = options?.ifNotExists ?? true;
      let sql = `CREATE MATERIALIZED VIEW ${ifNot ? "IF NOT EXISTS " : ""}${handle.fullName}`;
      if (handle.engine && handle.orderBy?.length) {
        const engineSql = engineToSql(handle.engine);
        const orderList = formatIdentifierList(handle.orderBy);
        sql += `\nENGINE = ${engineSql}\nORDER BY (${orderList})`;
      }
      sql += `\nTO ${handle.toTable}\nAS ${sqlText(handle.asSelect)}`;
      if (handle.populate) {
        sql += "\nPOPULATE";
      }
      return sql;
    },
  };
  return handle;
}
