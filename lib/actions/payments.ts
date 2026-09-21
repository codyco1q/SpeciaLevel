"use server";

import Stripe from "stripe";
import { getPublicInvoiceByToken } from "@/lib/actions/invoicing";

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export interface CreateCheckoutSessionResult {
  status: "success" | "error";
  checkoutUrl?: string;
  error?: string;
}

/**
 * Creates a Stripe Checkout session for a public invoice payment.
 * Unauthenticated callable; validated against the secure share token.
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

  const stripe = getStripeClient();
  if (!stripe) {
    return {
      status: "error",
      error:
        "Online card payment is currently unconfigured. Please use direct bank transfer or contact support.",
    };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const currency = (invoice.currency || "USD").toLowerCase();

  // Construct Stripe line items
  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (invoice.items && invoice.items.length > 0) {
    lineItems = invoice.items.map((item) => ({
      price_data: {
        currency,
        product_data: {
          name: item.description || `Item #${item.id}`,
        },
        unit_amount: Math.max(0, Math.round(Number(item.unitPrice) * 100)),
      },
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    }));

    if (invoice.taxAmount && Number(invoice.taxAmount) > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: `Tax (${invoice.taxRate}%)`,
          },
          unit_amount: Math.max(0, Math.round(Number(invoice.taxAmount) * 100)),
        },
        quantity: 1,
      });
    }
  } else {
    lineItems = [
      {
        price_data: {
          currency,
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `Payment for invoice ${invoice.invoiceNumber} • ${invoice.organizationName}`,
          },
          unit_amount: Math.max(50, Math.round(Number(invoice.total) * 100)),
        },
        quantity: 1,
      },
    ];
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: invoice.contact?.email || undefined,
      success_url: `${siteUrl}/pay/${shareToken}?success=true`,
      cancel_url: `${siteUrl}/pay/${shareToken}?canceled=true`,
      metadata: {
        invoice_id: invoice.id,
        org_id: invoice.organizationId || "",
        share_token: shareToken,
        invoice_number: invoice.invoiceNumber,
      },
    });

    if (!session.url) {
      return {
        status: "error",
        error: "Failed to generate Stripe checkout session URL.",
      };
    }

    return {
      status: "success",
      checkoutUrl: session.url,
    };
  } catch (err: any) {
    console.error("[payments] Stripe Checkout session error:", err?.message || err);
    return {
      status: "error",
      error: err?.message || "Failed to initiate online checkout session.",
    };
  }
}
