import react from "@repo/eslint-config/react";
import storybook from "eslint-plugin-storybook";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores(["storybook-static/", "!.storybook"]),
  react,
  storybook.configs["flat/recommended"],
);
