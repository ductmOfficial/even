// @ts-check
import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig } from "eslint/config";
import globals from "globals";

import base from "./base.js";

export default defineConfig(base, {
  files: ["**/*.{ts,tsx}"],
  extends: [eslintReact.configs["strict-type-checked"]],
  languageOptions: {
    globals: globals.browser,
  },
});
