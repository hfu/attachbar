import { defineConfig } from "vite";
import path from "path";

// Emits to the repo root `docs/` folder so GitHub Pages can serve this
// example directly (Settings → Pages → Deploy from a branch → /docs).
export default defineConfig({
  // Relative asset paths — GitHub project pages serve from
  // https://<user>.github.io/<repo>/, not the domain root.
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "../../docs"),
    emptyOutDir: true,
  },
});
