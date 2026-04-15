import isEmpty from "lodash-es/isEmpty.js";
import { quoteIdentifier } from "./identifiers.js";

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
        ? `ReplacingMergeTree(${quoteIdentifier(engine.versionColumn)})`
        : "ReplacingMergeTree"
      : "MergeTree";
  if (!engine.settings || isEmpty(engine.settings)) {
    return base;
  }
  const pairs = Object.entries(engine.settings).map(
    ([k, v]) => `${quoteIdentifier(k)} = ${formatSettingValue(v)}`
  );
  return `${base} SETTINGS ${pairs.join(", ")}`;
}

function formatSettingValue(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : String(v);
  return `'${String(v).replace(/'/g, "\\'")}'`;
}
