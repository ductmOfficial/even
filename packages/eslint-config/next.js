// @ts-check
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";

import react from "./react.js";

// Uses @next/eslint-plugin-next directly instead of eslint-config-next: the
// plugins bundled with eslint-config-next (react, import, jsx-a11y) do not
// support ESLint 10 yet, and @eslint-react in ./react.js already covers React.
export default defineConfig(globalIgnores(["**/.next/", "**/next-env.d.ts"]), react, {
  files: ["**/*.{js,mjs,cjs,ts,tsx}"],
  plugins: { "@next/next": nextPlugin },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
  },
});
