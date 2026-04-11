import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
  external: ["@nestjs/common", "@nestjs/core", "@kerobit/clickflow-core", "@clickhouse/client"],
  treeshake: true,
});
