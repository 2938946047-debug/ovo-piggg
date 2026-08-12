import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: externalBaseUrl ? undefined : {
    command: "pnpm dev --hostname 127.0.0.1",
    url: baseURL,
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], browserName: "chromium", channel: "chrome" } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", channel: "chrome" } },
  ],
});
