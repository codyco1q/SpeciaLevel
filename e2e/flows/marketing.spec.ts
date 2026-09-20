import { expect, test } from "@playwright/test";

import { serviceRoleClient } from "../helpers/supabase";
import { E2E_USER_EMAIL, SEED_FORM_SLUG } from "../setup/constants";

/**
 * Public lead capture flow — unauthenticated public form and marketing lead ingestion.
 *
 * Covers:
 *   - The EN/AR locale switcher on public routes, driving `<html dir>` + RTL rendering;
 *   - Public form builder validation and lead response submission;
 *   - Direct lead capture persistence to `marketing_leads`.
 */

test.describe("Public lead capture (EN/AR)", () => {
  test.afterAll(async () => {
    const supabase = serviceRoleClient();
    await supabase
      .from("profiles")
      .update({ preferred_language: "en" })
      .eq("email", E2E_USER_EMAIL);
  });

  test("locale switcher mirrors public page to RTL and back to LTR", async ({
    page,
  }) => {
    const toArabic = page.locator('button[aria-label="العربية"]:visible');
    const toEnglish = page.locator('button[aria-label="English"]:visible');

    await page.goto(`/f/${SEED_FORM_SLUG}`);

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

  test("public form blocks empty submissions with inline validation", async ({
    page,
  }) => {
    await page.goto(`/f/${SEED_FORM_SLUG}`);

    await page.getByRole("button", { name: "Book my consultation" }).click();

    await expect(page.getByText("This field is required").first()).toBeVisible();
  });

  test("public form submits, shows success state, and persists submission", async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const email = `e2e.lead.${suffix}@example.com`;

    await page.goto(`/f/${SEED_FORM_SLUG}`);

    await page.locator("#name").fill("E2E Lead");
    await page.locator("#email").fill(email);
    await page.locator("#company").fill("E2E Automation Co");
    await page
      .locator("#bottleneck")
      .fill("Manual data entry between our CRM and finance is slowing every month-end.");
    await page.getByRole("button", { name: "Book my consultation" }).click();

    await expect(
      page.getByText(
        "Thanks — we'll review your project and get back to you within one business day with next steps."
      )
    ).toBeVisible({ timeout: 20_000 });

    const supabase = serviceRoleClient();
    const { data: submission, error } = await supabase
      .from("inbound_form_submissions")
      .select("data")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(error).toBeNull();
    expect(submission).not.toBeNull();
    const subData = submission?.data as Record<string, unknown>;
    expect(subData?.name).toBe("E2E Lead");
    expect(subData?.email).toBe(email);
    expect(subData?.company).toBe("E2E Automation Co");
  });

  test("direct marketing lead submission persists to marketing_leads", async () => {
    const suffix = Date.now().toString(36);
    const email = `e2e.direct.${suffix}@example.com`;

    const supabase = serviceRoleClient();
    const { data, error } = await supabase
      .from("marketing_leads")
      .insert({
        name: "Direct Marketing Lead",
        email,
        company: "Direct Inc",
        bottleneck: "Direct lead capture verification",
        package_of_interest: "systems",
      })
      .select("id, name, email, company, status")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.name).toBe("Direct Marketing Lead");
    expect(data?.email).toBe(email);
    expect(data?.status).toBe("new");
  });
});

