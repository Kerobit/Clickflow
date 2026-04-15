/**
 * Defaults for integration tests (aligned with compose.test.yaml at repo root).
 * Vitest injects these via vitest.integration.config.ts when env vars are unset.
 */
export const DEFAULT_CLICKFLOW_TEST_URL = "http://127.0.0.1:39487";
export const DEFAULT_CLICKFLOW_TEST_DATABASE = "clickflow_it";
export const DEFAULT_CLICKFLOW_TEST_USER = "default";
export const DEFAULT_CLICKFLOW_TEST_PASSWORD = "clickflow_test";

export function getClickFlowTestUrl(): string {
  return process.env.CLICKFLOW_TEST_URL ?? DEFAULT_CLICKFLOW_TEST_URL;
}

export async function waitForClickhouseReady(
  baseUrl: string,
  timeoutMs = 120_000
): Promise<void> {
  const base = baseUrl.replace(/\/$/, "");
  const pingUrl = `${base}/ping`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(pingUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes("Ok") || res.status === 200) {
          return;
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`ClickHouse did not become ready at ${pingUrl}`);
}
