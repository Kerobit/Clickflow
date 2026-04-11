export type WherePrimitive = string | number | bigint | boolean | Date | null;

export type WhereClause<T> = {
  [K in keyof T]?:
    | WherePrimitive
    | { in: readonly WherePrimitive[] }
    | { gte: WherePrimitive }
    | { lte: WherePrimitive };
};
