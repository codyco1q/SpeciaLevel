import { expect, test } from "@playwright/test";

import { E2E_BASE_URL } from "../setup/constants";

/**
 * AI module flow — authenticated.
 *
 * The AI gateway calls an external provider, so the outcome of a run depends
 * on whether `AI_API_KEY` is configured in `.env.local`:
 *
 *   - configured   → the response card renders the provider output;
 *   - not set      → the server action returns the localized
 *                    "provider isn't configured" error, rendered as an
 *                    inline alert (no crash, no unhandled rejection).
 *
 * Both are valid: the spec waits for whichever outcome happens first and
 * asserts the page never throws, then covers prompt management (ai.manage)
 * by creating a template and opening its Run dialog.
 */

test.describe("AI playground & prompt management", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: E2E_BASE_URL },
    ]);
  });

  test("playground runs a one-off prompt and records the run without errors", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/ai");

    await expect(
      page.getByRole("heading", { level: 1, name: "AI & Intelligent Agents" })
    ).toBeVisible();

    // Playground is the default tab and starts from the empty response card.
    await expect(page.getByRole("tab", { name: "Playground" })).toHaveAttribute(
      "data-state",
      "active"
    );
    await expect(page.getByText("Output")).toBeVisible();
    await expect(
      page.getByText("Run a prompt to see the result here.")
    ).toBeVisible();

    await page
      .locator("#ai-playground-input")
      .fill("Draft a short follow-up email about yesterday's kickoff call.");
    await page.getByRole("button", { name: "Run", exact: true }).click();

    // Either the provider answered (output card) or the gateway reported a
    // configuration failure (inline alert) — both prove the request round-trip.
    await expect
      .poll(
        async () => {
          const alerts = await page.getByRole("alert").allTextContents();
          if (alerts.join(" ").trim().length > 0) return "error";

          const frames = await page.locator("pre").allTextContents();
          const output = frames
            .map((text) => text.trim())
            .filter((text) => text.length > 0 && text !== "—");
          return output.length > 0 ? "output" : "pending";
        },
        { timeout: 90_000, intervals: [500, 1_000, 2_000] }
      )
      .not.toBe("pending");

    const alerts = await page.getByRole("alert").allTextContents();
    if (alerts.join(" ").includes("AI_API_KEY")) {
      // Explicitly acceptable: the environment has no provider key.
      expect(alerts.join(" ")).toContain("isn't configured");
    }

    expect(pageErrors).toEqual([]);
  });

  test("creates a prompt template and opens its run dialog", async ({ page }) => {
    await page.goto("/ai");

    await page.getByRole("tab", { name: "Custom prompts" }).click();
    await expect(
      page.getByRole("button", { name: "New prompt" })
    ).toBeVisible();

    const name = `E2E Summary Prompt ${Date.now().toString(36)}`;
    const template = "Summarize the following text:\n{input}";

    await page.getByRole("button", { name: "New prompt" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "New prompt" })
    ).toBeVisible();

    await dialog.locator("#ai-prompt-name").fill(name);
    await dialog.locator("#ai-prompt-description").fill("Created by the E2E suite.");
    await dialog.locator("#ai-prompt-model-name").fill("gpt-4o-mini");
    await dialog.locator("#ai-prompt-template").fill(template);

    await dialog.getByRole("button", { name: "Create prompt" }).click();
    await expect(dialog).toBeHidden();

    // The new template renders as a card in the prompts list.
    const card = page
      .locator("div")
      .filter({ hasText: name })
      .filter({ has: page.getByRole("button", { name: "Run", exact: true }) })
      .last();
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    await expect(card).toContainText("E2E QA");

    // Running the stored prompt opens the run dialog with an input field.
    const runButton = card.getByRole("button", { name: "Run", exact: true });
    await expect(runButton).toBeEnabled();
    await runButton.click();

    const runDialog = page.getByRole("dialog");
    await expect(
      runDialog.getByRole("heading", { name: `${name} — Run prompt` })
    ).toBeVisible();
    await runDialog.locator("#ai-run-input").fill("Kickoff call notes: scope agreed.");
    await runDialog.getByRole("button", { name: "Run" }).click();

    // Same provider dependency as the playground run — wait for a settled result.
    await expect
      .poll(
        async () => {
          const alerts = await runDialog.getByRole("alert").allTextContents();
          if (alerts.join(" ").trim().length > 0) return "error";
          const frames = await runDialog.locator("pre").allTextContents();
          return frames.some((text) => text.trim().length > 0 && text.trim() !== "—")
            ? "output"
            : "pending";
        },
        { timeout: 90_000, intervals: [500, 1_000, 2_000] }
      )
      .not.toBe("pending");
  });
});
