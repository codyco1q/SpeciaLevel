import { defineConfig } from "@playwright/test";

import { E2E_BASE_URL, E2E_STORAGE_STATE } from "./e2e/setup/constants";

/**
 * Playwright configuration for the SpeciaLevel end-to-end suite.
 *
 * The suite drives the real Next.js app (`npm run dev`) against the
 * configured Supabase project. It is intentionally serial (`workers: 1`):
 * every spec shares one dev server, one seeded organization, and one
 * fixture set, so running a single worker keeps the data deterministic.
 *
 * Projects:
 *   - `setup` — `e2e/setup/global-setup.ts` provisions the E2E user +
 *     organization + CRM/invoice fixtures, then `auth.setup.ts` signs that
 *     user in through the real /login form and saves the Supabase session
 *     cookies to `e2e/.auth/user.json`.
 *   - `e2e`   — every flow spec, replaying that saved session.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/setup/global-setup.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  },
  projects: [
    {
      name: "setup",
      testMatch: /setup\/.*\.setup\.ts/,
    },
    {
      name: "e2e",
      testIgnore: /setup\/.*\.setup\.ts/,
      use: {
        storageState: E2E_STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: E2E_BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
