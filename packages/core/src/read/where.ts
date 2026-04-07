import type { TableHandle } from "../schema/table.js";

export type WherePrimitive = string | number | bigint | boolean | Date | null;

export type WhereClause<T> = {
  [K in keyof T]?:
    | WherePrimitive
    | { in: readonly WherePrimitive[] }
    | { gte: WherePrimitive }
    | { lte: WherePrimitive };
};

export function buildWhere(
  table: TableHandle<unknown, unknown>,
  where: WhereClause<unknown> | undefined
): { sql: string; params: Record<string, unknown> } {
  if (!where || Object.keys(where).length === 0) {
    return { sql: "", params: {} };
  }
  const parts: string[] = [];
  const params: Record<string, unknown> = {};
  let i = 0;

  for (const key of Object.keys(where)) {
    const col = table.columns[key];
    if (!col) {
      throw new Error(`Unknown column in where: ${key}`);
    }
    const chType = col.clickHouseType;
    const raw = (where as Record<string, unknown>)[key];

    if (raw === undefined) continue;

    const p = `cf_${i++}`;

    if (raw !== null && typeof raw === "object" && !(raw instanceof Date)) {
      const o = raw as Record<string, unknown>;
      if ("in" in o) {
        const arrType = `Array(${chType})`;
        parts.push(`${key} IN {${p}: ${arrType}}`);
        params[p] = o.in;
        continue;
      }
      if ("gte" in o) {
        parts.push(`${key} >= {${p}: ${chType}}`);
        params[p] = o.gte;
        continue;
      }
      if ("lte" in o) {
        parts.push(`${key} <= {${p}: ${chType}}`);
        params[p] = o.lte;
        continue;
      }
    }

    parts.push(`${key} = {${p}: ${chType}}`);
    params[p] = raw;
  }

  if (parts.length === 0) {
    return { sql: "", params: {} };
  }
  return { sql: `WHERE ${parts.join(" AND ")}`, params };
}

export function buildOrderBy(
  table: TableHandle<unknown, unknown>,
  orderBy: Record<string, "asc" | "desc"> | undefined
): string {
  if (!orderBy || Object.keys(orderBy).length === 0) {
    return "";
  }
  const segments: string[] = [];
  for (const [col, dir] of Object.entries(orderBy)) {
    if (!table.columns[col]) {
      throw new Error(`Unknown column in orderBy: ${col}`);
    }
    const d = dir === "desc" ? "DESC" : "ASC";
    segments.push(`${col} ${d}`);
  }
  return segments.length ? `ORDER BY ${segments.join(", ")}` : "";
}
