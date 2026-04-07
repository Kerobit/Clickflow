import type { TelemetryHooks, BufferFlushReason } from "../telemetry.js";

export interface InsertBufferOptions {
  maxBatchSize: number;
  maxWaitMs: number;
  maxQueueLength?: number;
}

type FlushCallback<TRow> = (
  rows: readonly TRow[],
  reason: BufferFlushReason
) => Promise<void>;

/**
 * In-memory batching for append-only inserts. May lose buffered rows on process crash; call flush on shutdown.
 */
export class InsertBuffer<TRow> {
  private queue: TRow[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private readonly hooks?: TelemetryHooks;
  private readonly tableName: string;

  constructor(
    tableName: string,
    private readonly flushFn: FlushCallback<TRow>,
    private readonly options: InsertBufferOptions,
    hooks?: TelemetryHooks
  ) {
    this.tableName = tableName;
    this.hooks = hooks;
  }

  enqueue(row: TRow): void {
    const maxQ = this.options.maxQueueLength;
    if (maxQ !== undefined && this.queue.length >= maxQ) {
      throw new Error(
        `InsertBuffer queue exceeded maxQueueLength (${maxQ}) for ${this.tableName}`
      );
    }
    this.queue.push(row);
    if (this.queue.length >= this.options.maxBatchSize) {
      void this.flush("size");
    } else {
      this.scheduleTimer();
    }
  }

  private scheduleTimer(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush("time");
    }, this.options.maxWaitMs);
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  async flush(reason: BufferFlushReason = "manual"): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await this.flushFn(batch, reason);
      this.hooks?.onBufferFlush?.({
        table: this.tableName,
        rowCount: batch.length,
        reason,
      });
    } finally {
      this.flushing = false;
    }
  }
}
