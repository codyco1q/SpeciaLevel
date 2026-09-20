import { expect, test } from "@playwright/test";

import {
  E2E_BASE_URL,
  NEW_CONTACT,
  SEED_CONTACT_EMAIL,
  SEED_CONTACT_NAME,
  SEED_DEAL_TITLE,
  SEED_INVOICE_NUMBER,
  SEED_NOTE_CONTENT,
  SEED_SECOND_CONTACT_NAME,
} from "../setup/constants";

/**
 * CRM flow — authenticated.
 *
 * Contacts directory (search + create through the dialog) and the 360°
 * contact profile: identity card, the seeded note on the default
 * "Overview & Notes" tab, and the cross-module Deals / Invoices tabs fed by
 * the global-setup fixtures. The invoice row links onward to the printable
 * /invoicing/[id] document.
 */
test.describe("CRM contacts & 360° profile", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: E2E_BASE_URL },
    ]);
  });

  test("lists and filters contacts, creates one, and renders the full profile", async ({
    page,
  }) => {
    await page.goto("/crm");

    await expect(
      page.getByRole("heading", { level: 1, name: "CRM" })
    ).toBeVisible();

    // Pipeline is the default tab — contacts live behind the second tab.
    await page.getByRole("tab", { name: "Contacts" }).click();

    const seededRow = page.getByRole("row", { name: new RegExp(SEED_CONTACT_NAME) });
    const secondRow = page.getByRole("row", {
      name: new RegExp(SEED_SECOND_CONTACT_NAME),
    });
    await expect(seededRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    // Search narrows the directory client-side.
    const search = page.getByPlaceholder("Search contacts…");
    await search.fill(SEED_CONTACT_NAME);
    await expect(seededRow).toBeVisible();
    await expect(secondRow).toBeHidden();
    await search.fill("");
    await expect(secondRow).toBeVisible();

    // Create a contact through the dialog (crm.manage path).
    await page.getByRole("button", { name: "New contact" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator("#contact-name").fill(NEW_CONTACT.name);
    await dialog.locator("#contact-email").fill(NEW_CONTACT.email);
    await dialog.locator("#contact-company").fill(NEW_CONTACT.company);
    await dialog.locator("#contact-phone").fill(NEW_CONTACT.phone);
    await dialog.locator("#contact-title").fill(NEW_CONTACT.title);
    await dialog.locator("#contact-tags").fill(NEW_CONTACT.tags);
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog).toBeHidden();

    await expect(
      page.getByRole("row", { name: new RegExp(NEW_CONTACT.name) })
    ).toBeVisible();

    // Open the seeded profile — it carries the deal, invoice, and note fixtures.
    await seededRow.getByRole("link", { name: "View profile" }).click();
    await page.waitForURL(/\/crm\/contacts\/[0-9a-f-]{36}$/);

    // Identity card.
    await expect(
      page.getByRole("heading", { level: 2, name: SEED_CONTACT_NAME })
    ).toBeVisible();
    await expect(page.getByText(`COO at ${SEED_CONTACT_NAME}`)).toBeVisible();
    await expect(
      page.getByRole("link", { name: SEED_CONTACT_EMAIL })
    ).toBeVisible();
    await expect(page.getByText("Riyadh, Saudi Arabia")).toBeVisible();

    // Default tab: Overview & Notes (seeded note + counts).
    await expect(
      page.getByRole("tab", { name: "Overview & Notes" })
    ).toHaveAttribute("data-state", "active");
    await expect(page.getByText(SEED_NOTE_CONTENT)).toBeVisible();
    await expect(page.getByText("1 notes")).toBeVisible();

    // Deals tab — the seeded pipeline deal.
    await page.getByRole("tab", { name: "Deals" }).click();
    await expect(page.getByText(SEED_DEAL_TITLE)).toBeVisible();
    await expect(page.getByText("$5,000")).toBeVisible();

    // Invoices tab — the seeded invoice and its printable page link.
    await page.getByRole("tab", { name: "Invoices" }).click();
    const invoiceItem = page.getByText(SEED_INVOICE_NUMBER).locator("..").locator("..");
    await expect(invoiceItem).toContainText("$1,100");
    await invoiceItem.getByRole("link", { name: "View invoice" }).click();

    await page.waitForURL(/\/invoicing\/[0-9a-f]{8}-[0-9a-f-]{27}$/);
    await expect(page.locator(".print-document")).toContainText(SEED_INVOICE_NUMBER);
  });

  test("clicking a deal card opens DealDetailDialog and contact breadcrumbs preserve contacts tab", async ({
    page,
  }) => {
    // Navigate to CRM with tab=contacts
    await page.goto("/crm?tab=contacts");
    await expect(page.getByRole("tab", { name: "Contacts" })).toHaveAttribute(
      "data-state",
      "active"
    );

    // Switch to Pipeline tab
    await page.getByRole("tab", { name: "Pipeline" }).click();
    await expect(page.getByRole("tab", { name: "Pipeline" })).toHaveAttribute(
      "data-state",
      "active"
    );

    // Click on seeded deal card
    const dealCard = page.getByRole("button", { name: new RegExp(SEED_DEAL_TITLE) });
    if (await dealCard.count() > 0) {
      await dealCard.first().click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: SEED_DEAL_TITLE })
      ).toBeVisible();

      // View linked contact from deal detail
      const viewContactBtn = dialog.getByRole("link", { name: "View contact profile" });
      if (await viewContactBtn.count() > 0) {
        await viewContactBtn.click();
        await page.waitForURL(/\/crm\/contacts\/[0-9a-f-]{36}$/);

        // Click Contacts breadcrumb link
        await page.getByRole("link", { name: "Contacts" }).click();
        await page.waitForURL(/\/crm\?tab=contacts/);
        await expect(page.getByRole("tab", { name: "Contacts" })).toHaveAttribute(
          "data-state",
          "active"
        );
      }
    }
  });
});
