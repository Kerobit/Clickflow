import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InsertBuffer } from "./buffer.js";

describe("InsertBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes when batch reaches maxBatchSize", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buf = new InsertBuffer("db.t", flush, { maxBatchSize: 2, maxWaitMs: 10_000 });
    buf.enqueue({ a: 1 });
    expect(flush).not.toHaveBeenCalled();
    buf.enqueue({ a: 2 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
    expect(flush).toHaveBeenCalledWith([{ a: 1 }, { a: 2 }], "size");
  });

  it("flushes on timer after maxWaitMs", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buf = new InsertBuffer("db.t", flush, { maxBatchSize: 100, maxWaitMs: 500 });
    buf.enqueue({ a: 1 });
    await vi.advanceTimersByTimeAsync(500);
    await vi.waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
    expect(flush).toHaveBeenCalledWith([{ a: 1 }], "time");
  });

  it("throws when maxQueueLength is exceeded", () => {
    const flush = vi.fn();
    const buf = new InsertBuffer("db.t", flush, {
      maxBatchSize: 2,
      maxWaitMs: 10_000,
      maxQueueLength: 1,
    });
    buf.enqueue({ a: 1 });
    expect(() => buf.enqueue({ a: 2 })).toThrow(/maxQueueLength/);
  });

  it("manual flush clears queue and calls flushFn", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const buf = new InsertBuffer("db.t", flush, { maxBatchSize: 10, maxWaitMs: 10_000 });
    buf.enqueue({ a: 1 });
    await buf.flush("manual");
    expect(flush).toHaveBeenCalledWith([{ a: 1 }], "manual");
    await buf.flush("manual");
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("invokes onBufferFlush telemetry when hooks provided", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const onBufferFlush = vi.fn();
    const buf = new InsertBuffer(
      "db.my_table",
      flush,
      { maxBatchSize: 1, maxWaitMs: 10_000 },
      { onBufferFlush }
    );
    buf.enqueue({ x: 1 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(onBufferFlush).toHaveBeenCalled());
    expect(onBufferFlush).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "db.my_table",
        rowCount: 1,
        reason: "size",
      })
    );
  });
});
