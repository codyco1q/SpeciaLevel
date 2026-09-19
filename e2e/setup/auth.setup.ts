import { expect, test as setup } from "@playwright/test";

import {
  E2E_STORAGE_STATE,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "./constants";

/**
 * Auth setup project — runs once before the flow specs.
 *
 * Signs the seeded E2E user in through the real /login form (no auth
 * shortcuts, so a broken login flow fails the suite) and persists the
 * Supabase session cookies to `e2e/.auth/user.json`. The `e2e` project
 * replays that file for every dashboard spec.
 */
setup("sign in through the login form and save the session", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.locator("#email").fill(E2E_USER_EMAIL);
  await page.locator("#password").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The login form pushes to /dashboard; the dashboard layout only renders
  // once the session cookies are readable server-side.
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: E2E_STORAGE_STATE });
});
