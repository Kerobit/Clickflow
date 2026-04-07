/** Declarative column type for DDL and typed row inference (OLAP-oriented, not ORM). */

export type ColumnDef<TJs> = {
  readonly kind: "ColumnDef";
  readonly clickHouseType: string;
  /** Phantom for TS inference */
  readonly _js?: TJs;
};

export type InferRow<T extends Record<string, ColumnDef<unknown>>> = {
  [K in keyof T]: T[K] extends ColumnDef<infer J> ? J : never;
};

export type InferInsert<T extends Record<string, ColumnDef<unknown>>> = {
  [K in keyof T]: T[K] extends ColumnDef<infer J> ? J : never;
};

function col<TJs>(clickHouseType: string): ColumnDef<TJs> {
  return { kind: "ColumnDef", clickHouseType };
}

export function string(): ColumnDef<string> {
  return col("String");
}

export function u8(): ColumnDef<number> {
  return col("UInt8");
}

export function u32(): ColumnDef<number> {
  return col("UInt32");
}

export function u64(): ColumnDef<bigint> {
  return col("UInt64");
}

export function i64(): ColumnDef<bigint> {
  return col("Int64");
}

export function float64(): ColumnDef<number> {
  return col("Float64");
}

export function boolean(): ColumnDef<boolean> {
  return col("Bool");
}

export function datetime(): ColumnDef<Date> {
  return col("DateTime");
}

export function date(): ColumnDef<string> {
  return col("Date");
}

export function uuid(): ColumnDef<string> {
  return col("UUID");
}
