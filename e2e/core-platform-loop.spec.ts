import { expect, test } from "@playwright/test";

import { serviceRoleClient } from "./helpers/supabase";
import {
  E2E_BASE_URL,
  NEW_INVOICE,
  SEED_CONTACT_EMAIL,
  SEED_CONTACT_NAME,
  SEED_DEAL_TITLE,
  SEED_FORM_SLUG,
  SEED_INVOICE_NUMBER,
  SEED_NOTE_CONTENT,
  SEED_SECOND_CONTACT_NAME,
} from "./setup/constants";

/**
 * SpeciaLevel Core Platform E2E Loop
 *
 * Covers the 4 critical platform user paths:
 *   1. Inbound Lead Capture & Arabic RTL switch (Public form submission + EN/AR RTL toggle + gateway redirect)
 *   2. Invoicing & Printable View (Creation + live math + /invoicing/[id] print doc)
 *   3. Contacts 360° Profile (Directory + search + 360° tabs: Notes, Deals, Invoices)
 *   4. AI Agent Playground (Execution roundtrip + error resilience)
 */

test.describe("Core Platform Loop", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: E2E_BASE_URL },
    ]);
  });

  // 1. Inbound Lead Capture & RTL switch
  test("1. Public inbound consultation form & Arabic RTL switch", async ({
    page,
  }) => {
    // Verify root gateway redirects authenticated users to dashboard
    await page.goto("/");
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to the public inbound form
    await page.goto(`/f/${SEED_FORM_SLUG}`);

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("button", { name: "Book my consultation" })
    ).toBeVisible();

    const uniqueEmail = `e2e.consultation.${Date.now().toString(36)}@example.com`;

    await page.locator("#name").fill("Sarah Jenkins");
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#company").fill("Apex Global Logistics");
    await page
      .locator("#bottleneck")
      .fill("Cross-departmental data sync is manual and takes 15 hours weekly.");

    await page.getByRole("button", { name: "Book my consultation" }).click();

    await expect(
      page.getByText(
        "Thanks — we'll review your project and get back to you within one business day with next steps."
      )
    ).toBeVisible({ timeout: 20_000 });

    const supabase = serviceRoleClient();
    const { data: submission } = await supabase
      .from("inbound_form_submissions")
      .select("data")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(submission).not.toBeNull();
    const subData = submission?.data as Record<string, unknown>;
    expect(subData?.name).toBe("Sarah Jenkins");
    expect(subData?.company).toBe("Apex Global Logistics");

    const toArabic = page.locator('button[aria-label="العربية"]:visible');
    await toArabic.click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", {
      timeout: 20_000,
    });

    const toEnglish = page.locator('button[aria-label="English"]:visible');
    await toEnglish.click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr", {
      timeout: 20_000,
    });
  });
  // 2. Invoicing & Printable View
  test("2. Invoicing creation, automatic totals, and printable document", async ({
    page,
  }) => {
    await page.goto("/invoicing");

    await expect(
      page.getByRole("heading", { level: 1, name: "Invoicing & Billing" })
    ).toBeVisible();

    await expect(
      page.getByRole("row", { name: new RegExp(SEED_INVOICE_NUMBER) })
    ).toBeVisible();

    await page.getByRole("button", { name: "New invoice" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator("#invoice-client").click();
    await page
      .getByRole("option", { name: new RegExp(NEW_INVOICE.client) })
      .click();
    await dialog.locator("#invoice-due-date").fill(NEW_INVOICE.dueDate);
    await dialog.locator("#invoice-tax-rate").fill(String(NEW_INVOICE.taxRate));
    await dialog.locator("#invoice-notes").fill(NEW_INVOICE.notes);

    await dialog.getByLabel("Description").fill(NEW_INVOICE.items[0].description);
    await dialog.getByLabel("Qty").fill(String(NEW_INVOICE.items[0].quantity));
    await dialog
      .getByLabel("Unit price")
      .fill(String(NEW_INVOICE.items[0].unitPrice));

    await dialog.getByRole("button", { name: "Add item" }).click();
    await dialog
      .getByLabel("Description")
      .nth(1)
      .fill(NEW_INVOICE.items[1].description);
    await dialog.getByLabel("Qty").nth(1).fill(String(NEW_INVOICE.items[1].quantity));
    await dialog
      .getByLabel("Unit price")
      .nth(1)
      .fill(String(NEW_INVOICE.items[1].unitPrice));

    await expect(
      dialog.getByText("Subtotal", { exact: true }).locator("..")
    ).toContainText(NEW_INVOICE.expectedSubtotal);
    await expect(
      dialog.getByText("Tax", { exact: true }).locator("..")
    ).toContainText(NEW_INVOICE.expectedTax);
    await expect(
      dialog.getByText("Total", { exact: true }).locator("..")
    ).toContainText(NEW_INVOICE.expectedTotal);

    await dialog.getByRole("button", { name: "Create invoice" }).click();
    await expect(dialog).toBeHidden();

    const createdRow = page.getByRole("row", { name: /INV-0002/ });
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(NEW_INVOICE.client);
    await expect(createdRow).toContainText(NEW_INVOICE.expectedTotal);

    await createdRow.getByRole("button", { name: "View" }).click();
    const detailDialog = page.getByRole("dialog");
    await expect(detailDialog).toContainText("INV-0002");
    await detailDialog.getByRole("link", { name: "Open full page" }).click();

    await page.waitForURL(/\/invoicing\/[0-9a-f]{8}-[0-9a-f-]{27}$/);

    const document = page.locator(".print-document");
    await expect(document).toBeVisible();
    await expect(document).toContainText("INV-0002");
    await expect(document).toContainText(NEW_INVOICE.client);
    await expect(document).toContainText(NEW_INVOICE.items[0].description);
    await expect(document).toContainText(NEW_INVOICE.items[1].description);
    await expect(document).toContainText(NEW_INVOICE.expectedSubtotal);
    await expect(document).toContainText(NEW_INVOICE.expectedTotal);

    const printButton = page.getByRole("button", { name: "Print / Save as PDF" });
    await expect(printButton).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(printButton).toBeHidden();
    await expect(document).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });

  // 3. Contacts 360° Profile
  test("3. CRM contacts directory, search, and 360° profile view", async ({
    page,
  }) => {
    await page.goto("/crm");

    await expect(
      page.getByRole("heading", { level: 1, name: "CRM" })
    ).toBeVisible();

    await page.getByRole("tab", { name: "Contacts" }).click();

    const seededRow = page.getByRole("row", { name: new RegExp(SEED_CONTACT_NAME) });
    const secondRow = page.getByRole("row", {
      name: new RegExp(SEED_SECOND_CONTACT_NAME),
    });
    await expect(seededRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    const search = page.getByPlaceholder("Search contacts…");
    await search.fill(SEED_CONTACT_NAME);
    await expect(seededRow).toBeVisible();
    await expect(secondRow).toBeHidden();
    await search.fill("");
    await expect(secondRow).toBeVisible();

    await seededRow.getByRole("link", { name: "View profile" }).click();
    await page.waitForURL(/\/crm\/contacts\/[0-9a-f-]{36}$/);

    await expect(
      page.getByRole("heading", { level: 2, name: SEED_CONTACT_NAME })
    ).toBeVisible();
    await expect(page.getByText(`COO at ${SEED_CONTACT_NAME}`)).toBeVisible();
    await expect(
      page.getByRole("link", { name: SEED_CONTACT_EMAIL })
    ).toBeVisible();
    await expect(page.getByText("Riyadh, Saudi Arabia")).toBeVisible();

    await expect(
      page.getByRole("tab", { name: "Overview & Notes" })
    ).toHaveAttribute("data-state", "active");
    await expect(page.getByText(SEED_NOTE_CONTENT)).toBeVisible();
    await expect(page.getByText("1 notes")).toBeVisible();

    await page.getByRole("tab", { name: "Deals" }).click();
    await expect(page.getByText(SEED_DEAL_TITLE)).toBeVisible();
    await expect(page.getByText("$5,000")).toBeVisible();

    await page.getByRole("tab", { name: "Invoices" }).click();
    const invoiceItem = page.getByText(SEED_INVOICE_NUMBER).locator("..").locator("..");
    await expect(invoiceItem).toContainText("$1,100");
    await invoiceItem.getByRole("link", { name: "View invoice" }).click();

    await page.waitForURL(/\/invoicing\/[0-9a-f]{8}-[0-9a-f-]{27}$/);
    await expect(page.locator(".print-document")).toContainText(SEED_INVOICE_NUMBER);
  });

  // 4. AI Agent Playground
  test("4. AI agent playground execution and output rendering", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/ai");

    await expect(
      page.getByRole("heading", { level: 1, name: "AI & Intelligent Agents" })
    ).toBeVisible();

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
      .fill("Analyze incoming CRM lead: Acme Logistics with 50 vehicles looking for telemetry integration.");
    await page.getByRole("button", { name: "Run", exact: true }).click();

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

    expect(pageErrors).toEqual([]);
  });
});
