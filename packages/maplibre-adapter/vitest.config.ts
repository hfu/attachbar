import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@attachbar/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@attachbar/dom-renderer": path.resolve(
        __dirname,
        "../dom-renderer/src/index.ts"
      ),
    },
  },
});
