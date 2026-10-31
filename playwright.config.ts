import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:5183";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "docs/qa-audit/evidence/playwright-report", open: "never" }],
  ],
  outputDir: "docs/qa-audit/evidence/test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5183 --strictPort",
    url: `${baseURL}/auth`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
