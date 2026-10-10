"use server";

import { getPublicInvoiceByToken } from "@/lib/actions/invoicing";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { PaymentProvider } from "@/types/database";
import {
  createPaymobSession,
  createPayTabsSession,
  createStripeSession,
} from "@/lib/services/payments-gateway";

export interface CreateCheckoutSessionResult {
  status: "success" | "error";
  checkoutUrl?: string;
  provider?: PaymentProvider;
  error?: string;
}

export interface OrganizationPaymentOption {
  provider: PaymentProvider | string;
  name: string;
  badge?: string;
  isConnected: boolean;
}

/**
 * Discovers connected payment gateways for the organization that owns the invoice.
 * Checks `organization_integrations` and environment fallback.
 */
export async function getInvoicePaymentOptions(
  shareToken: string
): Promise<{
  status: "success" | "error";
  options: OrganizationPaymentOption[];
  activeProvider: PaymentProvider | "manual" | "bank_transfer";
  error?: string;
}> {
  if (!shareToken) {
    return {
      status: "error",
      options: [],
      activeProvider: "manual",
      error: "Missing invoice share token.",
    };
  }

  const invoice = await getPublicInvoiceByToken(shareToken);
  if (!invoice) {
    return {
      status: "error",
      options: [],
      activeProvider: "manual",
      error: "Invoice not found.",
    };
  }

  const options: OrganizationPaymentOption[] = [
    {
      provider: "bank_transfer",
      name: "Bank Wire Transfer",
      badge: "Manual Settlement",
      isConnected: true,
    },
  ];

  if (!invoice.organizationId) {
    return {
      status: "success",
      options,
      activeProvider: "bank_transfer",
    };
  }

  const supabase = createServiceRoleClient();
  const { data: integrations } = await supabase
    .from("organization_integrations")
    .select("provider, status, credentials_encrypted, config")
    .eq("organization_id", invoice.organizationId)
    .eq("category", "payment")
    .eq("status", "connected");

  const connectedList = (integrations || []).map((i) => i.provider);

  if (connectedList.includes("paymob")) {
    options.unshift({
      provider: "paymob",
      name: "Paymob (Cards & Mobile Wallets)",
      badge: "MENA & Meeza",
      isConnected: true,
    });
  }

  if (connectedList.includes("paytabs")) {
    options.unshift({
      provider: "paytabs",
      name: "PayTabs (Mada, Apple Pay, Cards)",
      badge: "GCC & Mada",
      isConnected: true,
    });
  }

  if (connectedList.includes("fawry")) {
    options.unshift({
      provider: "fawry",
      name: "Fawry Pay",
      badge: "Egypt POS / Cash",
      isConnected: true,
    });
  }

  if (connectedList.includes("paypal")) {
    options.unshift({
      provider: "paypal",
      name: "PayPal & Digital Wallet",
      badge: "PayPal",
      isConnected: true,
    });
  }

  if (connectedList.includes("stripe") || process.env.STRIPE_SECRET_KEY) {
    options.unshift({
      provider: "stripe",
      name: "Credit / Debit Card (Stripe)",
      badge: "Global Cards",
      isConnected: true,
    });
  }

  const activeProvider = (options[0]?.provider as PaymentProvider) || "bank_transfer";

  return {
    status: "success",
    options,
    activeProvider,
  };
}

/**
 * Creates an online checkout / payment session for a public invoice payment.
 * Automatically delegates to the active payment provider configured in `organization_integrations`
 * (Paymob, PayTabs, Fawry, PayPal, or Stripe), or falls back to Stripe env credentials.
 */
export async function createInvoiceCheckoutSession(
  shareToken: string
): Promise<CreateCheckoutSessionResult> {
  if (!shareToken) {
    return { status: "error", error: "Missing invoice share token." };
  }

  const invoice = await getPublicInvoiceByToken(shareToken);
  if (!invoice) {
    return {
      status: "error",
      error: "Invoice not found or no longer shareable.",
    };
  }

  if (invoice.status === "paid") {
    return {
      status: "error",
      error: "This invoice has already been paid in full.",
    };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  let activeIntegration: {
    provider: string;
    credentials_encrypted: Record<string, any>;
    config: Record<string, any>;
  } | null = null;

  if (invoice.organizationId) {
    const supabase = createServiceRoleClient();
    const { data: integrations } = await supabase
      .from("organization_integrations")
      .select("provider, status, credentials_encrypted, config")
      .eq("organization_id", invoice.organizationId)
      .eq("category", "payment")
      .eq("status", "connected");

    if (integrations && integrations.length > 0) {
      const priorityOrder = ["paymob", "paytabs", "fawry", "paypal", "stripe"];
      for (const prov of priorityOrder) {
        const found = integrations.find((i) => i.provider === prov);
        if (found) {
          activeIntegration = found;
          break;
        }
      }
      if (!activeIntegration) {
        activeIntegration = integrations[0];
      }
    }
  }

  const provider =
    activeIntegration?.provider || (process.env.STRIPE_SECRET_KEY ? "stripe" : null);

  if (provider === "paymob") {
    const res = await createPaymobSession(
      invoice,
      activeIntegration?.credentials_encrypted || {}
    );
    if (res) return res;
  }

  if (provider === "paytabs") {
    const res = await createPayTabsSession(
      invoice,
      activeIntegration?.credentials_encrypted || {},
      siteUrl
    );
    if (res) return res;
  }

  if (provider === "paypal") {
    const creds = activeIntegration?.credentials_encrypted || {};
    if (creds.client_id || creds.clientId) {
      return {
        status: "success",
        provider: "paypal",
        checkoutUrl: `https://www.paypal.com/checkoutnow?token=${encodeURIComponent(
          invoice.shareToken
        )}`,
      };
    }
  }

  if (provider === "fawry") {
    const creds = activeIntegration?.credentials_encrypted || {};
    const merchantCode = creds.merchant_code || creds.merchantCode;
    if (merchantCode) {
      return {
        status: "success",
        provider: "fawry",
        checkoutUrl: `https://www.atfawry.com/ECommercePlugin/FawryPay.jsp?merchant=${encodeURIComponent(
          merchantCode
        )}&orderNo=${encodeURIComponent(invoice.invoiceNumber)}&amount=${encodeURIComponent(
          invoice.total
        )}`,
      };
    }
  }

  const stripeKey = activeIntegration?.credentials_encrypted?.secret_key;
  const stripeRes = await createStripeSession(invoice, siteUrl, stripeKey);
  if (stripeRes) return stripeRes;

  return {
    status: "error",
    error:
      "Online card payment is currently unconfigured for this invoice. Please use direct bank transfer or contact the merchant.",
  };
}
