import type { ClickHouseFacade } from "@clickflow/core";
import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLICKFLOW_CLICKHOUSE } from "./clickhouse.constants.js";
import { ClickHouseModule } from "./clickhouse.module.js";
import { ClickHouseService } from "./clickhouse.service.js";
import { InjectClickHouse } from "./inject-clickhouse.js";

function mockFacade(): ClickHouseFacade {
  return {
    query: vi.fn(),
    command: vi.fn(),
    with: vi.fn(),
    flushAll: vi.fn(),
    close: vi.fn(),
  };
}

describe("ClickHouseModule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forRoot provides ClickHouseService", async () => {
    const mock = mockFacade();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClickHouseModule.forRoot({
          url: "http://localhost:8123",
          database: "default",
        }),
      ],
    })
      .overrideProvider(CLICKFLOW_CLICKHOUSE)
      .useValue(mock)
      .compile();

    const svc = moduleRef.get(ClickHouseService);
    expect(svc).toBeDefined();
    await svc.query("SELECT 1");
    expect(mock.query).toHaveBeenCalled();
    await moduleRef.close();
  });

  it("forRootAsync resolves configuration", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClickHouseModule.forRootAsync({
          useFactory: async () => ({
            url: "http://127.0.0.1:65534",
            database: "default",
          }),
        }),
      ],
    }).compile();

    const svc = moduleRef.get(ClickHouseService);
    expect(svc).toBeDefined();
    await moduleRef.close();
  });

  it("InjectClickHouse injects facade token", async () => {
    const mock = mockFacade();

    @Injectable()
    class Probe {
      constructor(@InjectClickHouse() readonly ch: ClickHouseFacade) {}
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ClickHouseModule.forRoot({
          url: "http://localhost:8123",
        }),
      ],
      providers: [Probe],
    })
      .overrideProvider(CLICKFLOW_CLICKHOUSE)
      .useValue(mock)
      .compile();

    expect(moduleRef.get(Probe).ch).toBe(mock);
    await moduleRef.close();
  });
});
