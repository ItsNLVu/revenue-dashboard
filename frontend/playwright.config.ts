import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They run against the real stack, so start it first (see README, "Run the tests"):
 * PostgreSQL seeded with `npm run db:seed`, the backend on :4000 and the frontend on :3000.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // `next dev` compiles each page on first visit, so allow more time than the defaults
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});
