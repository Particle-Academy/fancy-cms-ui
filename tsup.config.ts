import { defineConfig } from "tsup";

export default defineConfig({
  // Two entries: the pure, framework-agnostic spine (`.`) and the React
  // renderer (`./react`). React stays external so the spine can be imported
  // without it.
  // `kit` is every kit component as an island (src/kit). Its lazy imports name
  // the whole kit, so it is an entry of its own, never reached from the others.
  entry: { index: "src/index.ts", react: "src/react/index.ts", editor: "src/editor/index.ts", kit: "src/kit/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "neutral",
  // fancy-echarts is reached only through the chart island's dynamic import, so
  // it stays a separate chunk in the host's bundle (src/islands/chart.tsx).
  // Every other kit package (the kit islands import about thirty, stylesheets
  // included) is the host's to install, never bundled here.
  external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", /^@particle-academy\//],
  treeshake: true,
  // Split the CJS build too. Without it esbuild inlines the chart island into
  // each CJS entry and hoists `require("@particle-academy/fancy-echarts")` to
  // the top, so a CommonJS host without that optional peer could not even load
  // the renderer. With it, the require sits in a chunk that is only reached
  // through the island's dynamic import, as in the ESM build.
  splitting: true,
});
