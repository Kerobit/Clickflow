import isEmpty from "lodash-es/isEmpty.js";
import {
  DummyDriver,
  type ExpressionBuilder,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  sql,
} from "kysely";
import type { TableHandle } from "../schema/table.js";
import type { WhereClause } from "./where.js";

/**
 * Internal compile-only path: Kysely + `MysqlQueryCompiler` + `DummyDriver`.
 *
 * This mirrors the query-compilation choice made by dialects such as
 * `kysely-clickhouse` (`createQueryCompiler` → `MysqlQueryCompiler`), but we
 * deliberately do not ship their `Driver` / `Connection` / introspection stack.
 * ClickFlow remains SQL-first: execution stays on `ClickHouseFacade` and
 * `@clickhouse/client`; this module only turns typed read options into SQL +
 * `query_params`-shaped placeholders (`{cf_i: <ClickHouse type>}`).
 */
let compileDb: Kysely<unknown> | undefined;

function getCompileDb(): Kysely<unknown> {
  if (!compileDb) {
    compileDb = new Kysely({
      dialect: {
        createAdapter: () => new MysqlAdapter(),
        createDriver: () => new DummyDriver(),
        createIntrospector: (db) => new MysqlIntrospector(db),
        createQueryCompiler: () => new MysqlQueryCompiler(),
      },
    });
  }
  return compileDb;
}

function tableSource(fullName: string) {
  return sql`${sql.raw(fullName)}`.as("_cf");
}

function mysqlPlaceholdersToClickhouseParams(
  sqlStr: string,
  parameters: readonly unknown[],
  chTypes: readonly string[]
): { sql: string; params: Record<string, unknown> } {
  let i = 0;
  const params: Record<string, unknown> = {};
  const out = sqlStr.replace(/\?/g, () => {
    if (i >= parameters.length || i >= chTypes.length) {
      throw new Error("ClickFlow compile-read: placeholder/type mismatch");
    }
    const name = `cf_${i}`;
    const fragment = `{${name}: ${chTypes[i]}}`;
    params[name] = parameters[i]!;
    i++;
    return fragment;
  });
  if (i !== parameters.length || i !== chTypes.length) {
    throw new Error("ClickFlow compile-read: placeholder count mismatch");
  }
  return { sql: out, params };
}

function buildWhereParts(
  table: TableHandle<unknown, unknown>,
  where: WhereClause<unknown> | undefined
): {
  chTypes: string[];
  whereFn: ((eb: ExpressionBuilder<unknown, string>) => unknown) | null;
} {
  if (!where || isEmpty(where)) {
    return { chTypes: [], whereFn: null };
  }

  const chTypes: string[] = [];
  const parts: Array<(eb: ExpressionBuilder<unknown, string>) => unknown> = [];

  for (const key of Object.keys(where)) {
    const col = table.columns[key];
    if (!col) {
      throw new Error(`Unknown column in where: ${key}`);
    }
    const chType = col.clickHouseType;
    const raw = (where as Record<string, unknown>)[key];
    if (raw === undefined) continue;

    if (raw !== null && typeof raw === "object" && !(raw instanceof Date)) {
      const o = raw as Record<string, unknown>;
      if ("in" in o) {
        const arr = o.in as readonly unknown[];
        for (let k = 0; k < arr.length; k++) chTypes.push(chType);
        parts.push((eb) => eb(key, "in", [...arr]));
        continue;
      }
      if ("gte" in o) {
        chTypes.push(chType);
        parts.push((eb) => eb(key, ">=", o.gte));
        continue;
      }
      if ("lte" in o) {
        chTypes.push(chType);
        parts.push((eb) => eb(key, "<=", o.lte));
        continue;
      }
    }

    chTypes.push(chType);
    parts.push((eb) => eb(key, "=", raw));
  }

  if (parts.length === 0) {
    return { chTypes: [], whereFn: null };
  }

  return {
    chTypes,
    whereFn: (eb) => eb.and(parts.map((p) => p(eb))),
  };
}

function appendLimitOffset(
  sqlStr: string,
  options: { limit?: number; offset?: number } | undefined
): string {
  const tail: string[] = [];
  if (options?.limit !== undefined) {
    tail.push(`LIMIT ${Number(options.limit)}`);
  }
  if (options?.offset !== undefined) {
    tail.push(`OFFSET ${Number(options.offset)}`);
  }
  if (tail.length === 0) return sqlStr;
  return `${sqlStr} ${tail.join(" ")}`;
}

/**
 * Compile a typed table scan (SELECT *) for execution via ClickHouseFacade.query.
 * LIMIT/OFFSET are inlined as numbers to match prior ClickFlow behavior.
 */
export function compileTableFind(
  table: TableHandle<unknown, unknown>,
  options?: {
    where?: WhereClause<unknown>;
    orderBy?: Record<string, "asc" | "desc">;
    limit?: number;
    offset?: number;
  }
): { sql: string; params: Record<string, unknown> } {
  const db = getCompileDb();
  const { chTypes: whereTypes, whereFn } = buildWhereParts(table, options?.where);

  let q = db.selectFrom(tableSource(table.fullName)).selectAll();
  if (whereFn) {
    q = q.where(whereFn);
  }

  if (options?.orderBy && !isEmpty(options.orderBy)) {
    for (const [col, dir] of Object.entries(options.orderBy)) {
      if (!table.columns[col]) {
        throw new Error(`Unknown column in orderBy: ${col}`);
      }
      q = q.orderBy(col, dir);
    }
  }

  const compiled = q.compile();
  const base = mysqlPlaceholdersToClickhouseParams(
    compiled.sql,
    compiled.parameters,
    whereTypes
  );
  return {
    sql: appendLimitOffset(base.sql, options).trim(),
    params: base.params,
  };
}

/** Compile SELECT count() AS c ... */
export function compileTableCount(
  table: TableHandle<unknown, unknown>,
  options?: { where?: WhereClause<unknown> }
): { sql: string; params: Record<string, unknown> } {
  const db = getCompileDb();
  const { chTypes, whereFn } = buildWhereParts(table, options?.where);
  let q = db
    .selectFrom(tableSource(table.fullName))
    .select(sql`count()`.as("c"));
  if (whereFn) {
    q = q.where(whereFn);
  }
  const compiled = q.compile();
  return mysqlPlaceholdersToClickhouseParams(compiled.sql, compiled.parameters, chTypes);
}

/** Compile SELECT 1 AS ok ... LIMIT 1 */
export function compileTableExists(
  table: TableHandle<unknown, unknown>,
  options?: { where?: WhereClause<unknown> }
): { sql: string; params: Record<string, unknown> } {
  const db = getCompileDb();
  const { chTypes, whereFn } = buildWhereParts(table, options?.where);
  let q = db
    .selectFrom(tableSource(table.fullName))
    .select(sql.lit(1).as("ok"));
  if (whereFn) {
    q = q.where(whereFn);
  }
  const compiled = q.compile();
  const base = mysqlPlaceholdersToClickhouseParams(
    compiled.sql,
    compiled.parameters,
    chTypes
  );
  return { sql: `${base.sql} LIMIT 1`.trim(), params: base.params };
}
