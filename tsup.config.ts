import { defineConfig } from "tsup";

export default defineConfig({
  // Two entries: the pure, framework-agnostic spine (`.`) and the React
  // renderer (`./react`). React stays external so the spine can be imported
  // without it.
  entry: { index: "src/index.ts", react: "src/react/index.ts", editor: "src/editor/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "neutral",
  external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  treeshake: true,
});
