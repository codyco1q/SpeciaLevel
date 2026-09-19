/**
 * Single source of truth for everything the E2E suite needs to be
 * deterministic: the seeded Supabase user, its organization, the fixture
 * rows `global-setup.ts` writes, and the storage-state file the auth setup
 * project produces.
 *
 * Nothing in here is a secret: the user is a throwaway account that lives
 * only in the E2E organization, and the credentials are intentionally
 * checked in so `npx playwright test` works from a clean clone.
 */

export const E2E_USER_EMAIL = "e2e.qa@specialevel.dev";
export const E2E_USER_PASSWORD = "SpeciaLevel-E2E-2026!";
export const E2E_USER_FULL_NAME = "E2E QA";

export const E2E_ORG_NAME = "SpeciaLevel E2E Org";
export const E2E_ORG_SLUG = "specialevel-e2e";

/** Saved Supabase session for the `e2e` project (relative to the repo root). */
export const E2E_STORAGE_STATE = "e2e/.auth/user.json";

/** Base URL the suite drives — override with the E2E_BASE_URL env var. */
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** Seed user's locale, pinned so string assertions are always English. */
export const E2E_PREFERRED_LANGUAGE = "en";

/** Contact used by the CRM 360° profile spec (has deal + invoice + note). */
export const SEED_CONTACT_NAME = "Acme Corp";
export const SEED_CONTACT_EMAIL = "jane.smith@acme.test";

/** Second seeded contact, used as the invoicing spec's client. */
export const SEED_SECOND_CONTACT_NAME = "Globex Industries";

/** Deal fixture already attached to SEED_CONTACT_NAME. */
export const SEED_DEAL_TITLE = "Website Redesign Proposal";
export const SEED_DEAL_VALUE = 5_000;

/** Note fixture on SEED_CONTACT_NAME. */
export const SEED_NOTE_CONTENT =
  "Intro call recorded — follow up re: proposal by Thursday.";

/** Invoice fixture attached to SEED_CONTACT_NAME. */
export const SEED_INVOICE_NUMBER = "INV-0001";
export const SEED_INVOICE_SUBTOTAL = 1_000;
export const SEED_INVOICE_TAX_RATE = 10;
export const SEED_INVOICE_TOTAL = 1_100;

/** Contact the CRM spec creates through the "New contact" dialog. */
export const NEW_CONTACT = {
  name: "Nadia Rahman",
  email: "nadia.rahman@northwind.test",
  company: "Northwind Trading",
  phone: "+1 555 010 0199",
  title: "Head of Operations",
  tags: "retail logistics",
} as const;

/** Invoice the invoicing spec creates through the "New invoice" dialog. */
export const NEW_INVOICE = {
  client: SEED_SECOND_CONTACT_NAME,
  dueDate: "2026-12-31",
  taxRate: 10,
  notes: "Net 15 from the issue date.",
  items: [
    { description: "Automation build — phase 1", quantity: 2, unitPrice: 1_250 },
    { description: "Monthly retainer", quantity: 1, unitPrice: 800 },
  ],
  // 2 × 1,250 + 1 × 800 = 3,300 subtotal · +10% tax = 330 · total 3,630
  expectedSubtotal: "$3,300",
  expectedTax: "$330",
  expectedTotal: "$3,630",
} as const;
