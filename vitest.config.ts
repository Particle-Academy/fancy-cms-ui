import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // An optional peer this package does not install: the chart island's
      // tests run against a recording stand-in (tests/chart-island.test.tsx).
      "@particle-academy/fancy-echarts": fileURLToPath(new URL("./tests/stubs/fancy-echarts.tsx", import.meta.url)),
    },
  },
});
