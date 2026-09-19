import { expect, test } from "@playwright/test";

import { serviceRoleClient } from "../helpers/supabase";
import { E2E_USER_EMAIL } from "../setup/constants";

/**
 * Marketing site flow — public, unauthenticated lead capture.
 *
 * Covers the two integration points the marketing site owns:
 *   - the EN/AR locale switcher, which drives `<html dir>` + the copy;
 *   - the contact form server action, which must persist a `marketing_leads`
 *     row through the service-role client and render the localized success
 *     panel.
 *
 * The suite runs with the E2E session attached, so switching the locale also
 * mirrors `preferred_language` onto that profile. The last action of the
 * locale test restores English, and `afterAll` re-pins it as a safety net for
 * the dashboard specs that share the same seeded user.
 */

test.describe("Marketing lead capture (EN/AR)", () => {
  test.afterAll(async () => {
    const supabase = serviceRoleClient();
    await supabase
      .from("profiles")
      .update({ preferred_language: "en" })
      .eq("email", E2E_USER_EMAIL);
  });

  test("locale switcher mirrors the page to RTL and back to LTR", async ({
    page,
  }) => {
    // The navbar renders the switcher twice (desktop + mobile shell); only
    // one is visible at a time, so target the visible instance explicitly.
    const toArabic = page.locator('button[aria-label="العربية"]:visible');
    const toEnglish = page.locator('button[aria-label="English"]:visible');

    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(toArabic).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Book my consultation" })
    ).toBeVisible();

    // Switch to Arabic.
    await toArabic.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", {
      timeout: 20_000,
    });
    await expect(page.locator("h1")).toContainText("حان وقت التغيير");
    await expect(page.getByRole("button", { name: "احجز استشارتي" })).toBeVisible();

    // Switch back so the rest of the suite (and the shared profile) is English.
    await toEnglish.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr", {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: "Book my consultation" })
    ).toBeVisible();
  });

  test("contact form blocks empty submissions with inline validation", async ({
    page,
  }) => {
    await page.goto("/");

    const contact = page.locator("#contact");
    await contact.scrollIntoViewIfNeeded();
    await contact.getByRole("button", { name: "Book my consultation" }).click();

    await expect(contact.getByText("Please enter your full name.")).toBeVisible();
    await expect(contact.getByText("Please enter a valid email address.")).toBeVisible();
    await expect(
      contact.getByText(
        "Give us a sentence or two about your current bottleneck or project scope."
      )
    ).toBeVisible();
  });

  test("contact form submits, shows the success state, and persists the lead", async ({
    page,
  }) => {
    // Unique per run: the assertion can never be satisfied by an older row.
    const suffix = Date.now().toString(36);
    const email = `e2e.marketing.${suffix}@example.com`;

    await page.goto("/");

    const contact = page.locator("#contact");
    await contact.scrollIntoViewIfNeeded();

    await contact.locator("#name").fill("E2E Lead");
    await contact.locator("#email").fill(email);
    await contact.locator("#company").fill("E2E Automation Co");
    await contact
      .locator("#bottleneck")
      .fill("Manual data entry between our CRM and finance is slowing every month-end.");
    await contact.getByRole("button", { name: "Book my consultation" }).click();

    // Server action → localized success panel.
    await expect(
      page.getByRole("heading", { name: "Request received" })
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(
        "Thanks — we'll review your project and get back to you within one business day with next steps."
      )
    ).toBeVisible();

    // The lead must have landed in `marketing_leads` (service-role write path).
    const supabase = serviceRoleClient();
    const { data, error } = await supabase
      .from("marketing_leads")
      .select("name, email, company, bottleneck, status")
      .eq("email", email)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.name).toBe("E2E Lead");
    expect(data?.company).toBe("E2E Automation Co");
    expect(data?.status).toBe("new");
    expect(data?.bottleneck).toContain("Manual data entry");
  });
});
