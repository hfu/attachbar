import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@attachbar/maplibre-adapter": path.resolve(__dirname, "../../packages/maplibre-adapter/src/index.ts"),
      "@attachbar/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@attachbar/dom-renderer": path.resolve(__dirname, "../../packages/dom-renderer/src/index.ts"),
    },
  },
});
