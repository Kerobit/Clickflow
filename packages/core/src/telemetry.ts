export type BufferFlushReason = "size" | "time" | "manual" | "shutdown";

export interface TelemetryHooks {
  onQueryStart?(event: {
    query: string;
    queryParams?: Record<string, unknown>;
  }): void;
  onQueryEnd?(event: {
    query: string;
    durationMs: number;
    success: boolean;
    error?: Error;
  }): void;
  onInsert?(event: {
    table: string;
    rowCount: number;
    durationMs: number;
    success: boolean;
    error?: Error;
  }): void;
  onBufferFlush?(event: {
    table: string;
    rowCount: number;
    reason: BufferFlushReason;
  }): void;
}
