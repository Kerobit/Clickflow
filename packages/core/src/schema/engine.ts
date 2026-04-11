import isEmpty from "lodash-es/isEmpty.js";

export type MergeTreeEngine =
  | { name: "MergeTree" }
  | { name: "ReplacingMergeTree"; versionColumn?: string };

export type EngineSpec = MergeTreeEngine & {
  settings?: Record<string, string | number | boolean>;
};

export function engineToSql(engine: EngineSpec): string {
  const base =
    engine.name === "ReplacingMergeTree"
      ? engine.versionColumn
        ? `ReplacingMergeTree(${quoteIdent(engine.versionColumn)})`
        : "ReplacingMergeTree"
      : "MergeTree";
  if (!engine.settings || isEmpty(engine.settings)) {
    return base;
  }
  const pairs = Object.entries(engine.settings).map(
    ([k, v]) => `${quoteIdent(k)} = ${formatSettingValue(v)}`
  );
  return `${base} SETTINGS ${pairs.join(", ")}`;
}

function quoteIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return name;
}

function formatSettingValue(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : String(v);
  return `'${String(v).replace(/'/g, "\\'")}'`;
}
