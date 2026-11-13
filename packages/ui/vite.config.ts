// The package tsconfig sets `types: []` because src/ targets the browser, but this file runs in Node.
// Trade-off: the reference applies to the whole tsconfig program, so src/ can also see Node globals.
/// <reference types="node" />

import { execFileSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";

// In watch mode (`pnpm dev`) Vite empties dist/ on every rebuild, deleting the .d.ts files
// that `tsc` adds after `vite build`. Re-emit them after each rebuild so consumers keep their types.
function emitTypesInWatchMode(): Plugin {
  return {
    name: "ui:emit-types-in-watch-mode",
    apply: "build",
    writeBundle() {
      if (!this.meta.watchMode) return;
      try {
        execFileSync("tsc", ["-p", "tsconfig.build.json"], { stdio: "inherit" });
      } catch {
        // tsc has already printed the type errors; keep watching instead of exiting.
      }
    },
  };
}

export default defineConfig({
  plugins: [emitTypesInWatchMode()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
    },
    // Apps minify their own bundles; shipping readable code keeps stack traces and debugging clear.
    minify: false,
    sourcemap: true,
    rolldownOptions: {
      external: [/^react(-dom)?($|\/)/],
      output: {
        // One output file per source module, so consumers' bundlers can drop unused components.
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
  },
});
