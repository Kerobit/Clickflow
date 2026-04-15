import { defineConfig } from "vitest/config";
import {
  DEFAULT_CLICKFLOW_TEST_DATABASE,
  DEFAULT_CLICKFLOW_TEST_PASSWORD,
  DEFAULT_CLICKFLOW_TEST_URL,
  DEFAULT_CLICKFLOW_TEST_USER,
} from "./tests/integration/config.js";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.integration.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    sequence: {
      concurrent: false,
    },
    globalSetup: "./tests/integration/global-setup.ts",
    env: {
      CLICKFLOW_TEST_URL: process.env.CLICKFLOW_TEST_URL ?? DEFAULT_CLICKFLOW_TEST_URL,
      CLICKFLOW_TEST_DATABASE:
        process.env.CLICKFLOW_TEST_DATABASE ?? DEFAULT_CLICKFLOW_TEST_DATABASE,
      CLICKFLOW_TEST_USER: process.env.CLICKFLOW_TEST_USER ?? DEFAULT_CLICKFLOW_TEST_USER,
      CLICKFLOW_TEST_PASSWORD:
        process.env.CLICKFLOW_TEST_PASSWORD ?? DEFAULT_CLICKFLOW_TEST_PASSWORD,
    },
  },
});
