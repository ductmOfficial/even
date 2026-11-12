import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const pgliteStub = fileURLToPath(new URL("./src/db/pglite-stub.ts", import.meta.url));

/** Keeps the PGlite runtime out of the main bundle (see src/db/pglite-stub.ts). */
function stubPgliteForDrizzle(): Plugin {
  return {
    name: "even:stub-pglite-for-drizzle",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "@electric-sql/pglite" && importer?.includes("drizzle-orm")) return pgliteStub;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [stubPgliteForDrizzle(), react(), tailwindcss()],
  // PGlite ships its own WASM + data bundle; pre-bundling breaks the asset URLs.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 600 },
  server: { port: 3500, strictPort: true },
  preview: { port: 3501, strictPort: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
