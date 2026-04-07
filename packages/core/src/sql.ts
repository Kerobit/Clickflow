/**
 * Tagged template that returns the query string as-is.
 * Use ClickHouse named parameters in the text: `{name: Type}` and pass values via `query(..., params)`.
 * Do not interpolate untrusted user input into the template; use parameters instead.
 */
export type SqlString = string & { readonly __clickflowSql?: true };

export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlString {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== "string") {
      throw new TypeError(
        "clickflow sql: only string fragments may be interpolated; use query parameters for values"
      );
    }
    out += v + (strings[i + 1] ?? "");
  }
  return out as SqlString;
}

/**
 * Escape hatch: embed raw SQL verified by the caller. Prefer `sql` + parameters.
 */
export function rawSql(fragment: string): SqlString {
  return fragment as SqlString;
}

export function sqlText(q: string | SqlString): string {
  return typeof q === "string" ? q : q;
}
