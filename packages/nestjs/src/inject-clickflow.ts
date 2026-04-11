import { Inject } from "@nestjs/common";
import { CLICKFLOW_CLICKHOUSE } from "./clickflow.constants.js";

/** Inject the underlying `ClickHouseFacade` (same instance as `ClickFlowService` uses). */
export const InjectClickFlow = (): ParameterDecorator =>
  Inject(CLICKFLOW_CLICKHOUSE);
