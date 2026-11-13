// @ts-check
import { defineConfig } from "eslint/config";
import globals from "globals";

import react from "./react.js";

// For Vite single-page apps: the React preset for src/, plus Node globals for the
// config files (vite.config.ts, vitest.config.ts) that Vite runs in Node.
export default defineConfig(react, {
  files: ["*.config.{js,mjs,ts}"],
  languageOptions: {
    globals: globals.node,
  },
});
