import vite from "@repo/eslint-config/vite";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig(vite, {
  // Playwright specs and config run in Node.
  files: ["e2e/**/*.ts", "playwright.config.ts"],
  languageOptions: { globals: globals.node },
});
