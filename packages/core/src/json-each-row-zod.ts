import type { ZodType } from "zod";
import { z } from "zod";

/**
 * Validates JSONEachRow-style query results (array of row objects) against a Zod schema for one row.
 */
export function parseJsonEachRowRows<TRow>(
  data: unknown,
  rowSchema: ZodType<TRow>
): TRow[] {
  return z.array(rowSchema).parse(data);
}

/**
 * Same as {@link parseJsonEachRowRows} but returns a result object instead of throwing.
 */
export function safeParseJsonEachRowRows<TRow>(
  data: unknown,
  rowSchema: ZodType<TRow>
) {
  return z.array(rowSchema).safeParse(data);
}
