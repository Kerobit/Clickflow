import { Inject } from "@nestjs/common";
import { CLICKFLOW_CLICKHOUSE } from "./clickhouse.constants.js";

/** Inject the underlying `ClickHouseFacade` (same instance as `ClickHouseService` uses). */
export const InjectClickHouse = (): ParameterDecorator =>
  Inject(CLICKFLOW_CLICKHOUSE);
