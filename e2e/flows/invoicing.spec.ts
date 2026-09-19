import { expect, test } from "@playwright/test";

import {
  E2E_BASE_URL,
  NEW_INVOICE,
  SEED_INVOICE_NUMBER,
} from "../setup/constants";

/**
 * Invoicing flow — authenticated.
 *
 * Exercises the full billing loop end to end:
 *   list (seeded fixture) → create dialog with two line items → live
 *   subtotal/tax/total math → persisted row → detail dialog → dedicated
 *   printable document at /invoicing/[id], including the print media
 *   stylesheet that hides the screen-only action bar.
 *
 * The new invoice is billed to the second seeded contact so the CRM
 * profile spec's invoice assertions stay isolated from this run's data.
 */
test.describe("Invoicing & billing", () => {
  test.beforeEach(async ({ context }) => {
    // Pin the locale cookie so copy assertions are always English, no matter
    // what the other specs did to the shared profile preference.
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: E2E_BASE_URL },
    ]);
  });

  test("creates an invoice, computes totals, and renders the printable document", async ({
    page,
  }) => {
    await page.goto("/invoicing");

    await expect(
      page.getByRole("heading", { level: 1, name: "Invoicing & Billing" })
    ).toBeVisible();

    // Seeded fixture from global-setup is on the list.
    await expect(
      page.getByRole("row", { name: new RegExp(SEED_INVOICE_NUMBER) })
    ).toBeVisible();

    await page.getByRole("button", { name: "New invoice" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Client + billing metadata.
    await dialog.locator("#invoice-client").click();
    await page
      .getByRole("option", { name: new RegExp(NEW_INVOICE.client) })
      .click();
    await dialog.locator("#invoice-due-date").fill(NEW_INVOICE.dueDate);
    await dialog.locator("#invoice-tax-rate").fill(String(NEW_INVOICE.taxRate));
    await dialog.locator("#invoice-notes").fill(NEW_INVOICE.notes);

    // First line item.
    await dialog.getByLabel("Description").fill(NEW_INVOICE.items[0].description);
    await dialog.getByLabel("Qty").fill(String(NEW_INVOICE.items[0].quantity));
    await dialog
      .getByLabel("Unit price")
      .fill(String(NEW_INVOICE.items[0].unitPrice));

    // Second line item (added through the dialog's repeatable rows).
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

    // Live totals: 3,300 subtotal · 330 tax · 3,630 total.
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

    // Persisted: the list refreshes with the next invoice number in the org.
    const createdRow = page.getByRole("row", { name: /INV-0002/ });
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(NEW_INVOICE.client);
    await expect(createdRow).toContainText(NEW_INVOICE.expectedTotal);

    // Detail dialog → dedicated printable page.
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

    // The action bar (print trigger) is screen-only: the print stylesheet
    // hides it while the document itself stays visible.
    const printButton = page.getByRole("button", { name: "Print / Save as PDF" });
    await expect(printButton).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(printButton).toBeHidden();
    await expect(document).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });
});
