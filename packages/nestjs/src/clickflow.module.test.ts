import type { ClickHouseFacade } from "@kerobit/clickflow-core";
import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLICKFLOW_CLICKHOUSE } from "./clickflow.constants.js";
import { ClickFlowModule } from "./clickflow.module.js";
import { ClickFlowService } from "./clickflow.service.js";
import { InjectClickFlow } from "./inject-clickflow.js";

function mockFacade(): ClickHouseFacade {
  return {
    query: vi.fn(),
    queryRows: vi.fn(),
    command: vi.fn(),
    with: vi.fn(),
    flushAll: vi.fn(),
    close: vi.fn(),
  };
}

describe("ClickFlowModule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forRoot provides ClickFlowService", async () => {
    const mock = mockFacade();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClickFlowModule.forRoot({
          url: "http://localhost:39487",
          database: "default",
        }),
      ],
    })
      .overrideProvider(CLICKFLOW_CLICKHOUSE)
      .useValue(mock)
      .compile();

    const svc = moduleRef.get(ClickFlowService);
    expect(svc).toBeDefined();
    await svc.query("SELECT 1");
    expect(mock.query).toHaveBeenCalled();
    await moduleRef.close();
  });

  it("forRootAsync resolves configuration", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClickFlowModule.forRootAsync({
          useFactory: async () => ({
            url: "http://127.0.0.1:65534",
            database: "default",
          }),
        }),
      ],
    }).compile();

    const svc = moduleRef.get(ClickFlowService);
    expect(svc).toBeDefined();
    await moduleRef.close();
  });

  it("InjectClickFlow injects facade token", async () => {
    const mock = mockFacade();

    @Injectable()
    class Probe {
      constructor(@InjectClickFlow() readonly ch: ClickHouseFacade) {}
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ClickFlowModule.forRoot({
          url: "http://localhost:39487",
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
