import { defineConfig, devices } from "@playwright/test";

const PORT = 3501;

// E2E runs against the production build so the PGlite worker and WASM are tested as shipped.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "retain-on-failure",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    // CI uses the Chrome that the runner image ships; locally, Playwright's Chromium.
    ...(process.env.CHROME_PATH && { launchOptions: { executablePath: process.env.CHROME_PATH } }),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm preview --strictPort",
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
