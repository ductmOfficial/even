// @ts-check

/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  // Dependabot bodies contain release notes with long lines and URLs that break body-max-line-length;
  // their headers already follow the prefixes set in .github/dependabot.yml.
  ignores: [(message) => message.includes("Signed-off-by: dependabot[bot]")],
};
