import Stripe from "stripe";
import type { PaymentProvider } from "@/types/database";

export interface CheckoutResult {
  status: "success" | "error";
  checkoutUrl?: string;
  provider?: PaymentProvider;
  error?: string;
}

export function getStripeClient(customKey?: string): Stripe | null {
  const secretKey = customKey || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export async function createPaymobSession(
  invoice: any,
  creds: Record<string, any>
): Promise<CheckoutResult | null> {
  const apiKey = creds.api_key || creds.apiKey || creds.secret_key;
  const iframeId = creds.iframe_id || creds.iframeId || "1";
  const integrationId = creds.integration_id || creds.integrationId;

  if (apiKey) {
    try {
      const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        const token = authData.token;
        const amountCents = Math.round(Number(invoice.total) * 100);

        const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_token: token,
            delivery_needed: "false",
            amount_cents: String(amountCents),
            currency: (invoice.currency || "EGP").toUpperCase(),
            merchant_order_id: `${invoice.id}-${Date.now()}`,
          }),
        });

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          const paymentKeyRes = await fetch(
            "https://accept.paymob.com/api/acceptance/payment_keys",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                auth_token: token,
                amount_cents: String(amountCents),
                expiration: 3600,
                order_id: orderData.id,
                billing_data: {
                  first_name: invoice.contact?.name?.split(" ")[0] || "Customer",
                  last_name:
                    invoice.contact?.name?.split(" ").slice(1).join(" ") || "Client",
                  email: invoice.contact?.email || "customer@specialevel.com",
                  phone_number: invoice.contact?.phone || "+201000000000",
                  apartment: "NA",
                  floor: "NA",
                  street: "NA",
                  building: "NA",
                  shipping_method: "PKG",
                  postal_code: "NA",
                  city: "Cairo",
                  country: "EG",
                  state: "Cairo",
                },
                currency: (invoice.currency || "EGP").toUpperCase(),
                integration_id: integrationId ? Number(integrationId) : undefined,
              }),
            }
          );

          if (paymentKeyRes.ok) {
            const paymentKeyData = await paymentKeyRes.json();
            return {
              status: "success",
              provider: "paymob",
              checkoutUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKeyData.token}`,
            };
          }
        }
      }
    } catch (err: any) {
      console.warn("[payments] Paymob error:", err?.message);
    }
  }

  return {
    status: "success",
    provider: "paymob",
    checkoutUrl: `https://accept.paymobsolutions.com/unifiedcheckout/?publicKey=${encodeURIComponent(
      creds.public_key || apiKey || ""
    )}&clientSecret=${encodeURIComponent(invoice.shareToken)}`,
  };
}


export async function createPayTabsSession(
  invoice: any,
  creds: Record<string, any>,
  siteUrl: string
): Promise<CheckoutResult | null> {
  const serverKey = creds.server_key || creds.serverKey;
  const profileId = creds.profile_id || creds.profileId;
  const region = (creds.region || "GLOBAL").toUpperCase();

  if (serverKey && profileId) {
    try {
      const endpoint =
        region === "EGY"
          ? "https://secure-egypt.paytabs.com/payment/request"
          : region === "SAU"
          ? "https://secure.paytabs.sa/payment/request"
          : "https://secure.paytabs.com/payment/request";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: serverKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_id: Number(profileId),
          tran_type: "sale",
          tran_class: "ecom",
          cart_id: invoice.id,
          cart_description: `Invoice ${invoice.invoiceNumber}`,
          cart_currency: (invoice.currency || "USD").toUpperCase(),
          cart_amount: Number(invoice.total),
          callback: `${siteUrl}/api/webhooks/paytabs`,
          return: `${siteUrl}/pay/${invoice.shareToken}?success=true`,
          customer_details: {
            name: invoice.contact?.name || "Customer",
            email: invoice.contact?.email || "customer@specialevel.com",
            phone: invoice.contact?.phone || "+000000000",
            street1: "NA",
            city: "NA",
            country: "US",
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.redirect_url) {
          return {
            status: "success",
            provider: "paytabs",
            checkoutUrl: data.redirect_url,
          };
        }
      }
    } catch (err: any) {
      console.warn("[payments] PayTabs error:", err?.message);
    }
  }
  return null;
}

export async function createStripeSession(
  invoice: any,
  siteUrl: string,
  customKey?: string
): Promise<CheckoutResult | null> {
  const stripe = getStripeClient(customKey);
  if (!stripe) return null;

  const currency = (invoice.currency || "USD").toLowerCase();
  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (invoice.items && invoice.items.length > 0) {
    lineItems = invoice.items.map((item: any) => ({
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
      success_url: `${siteUrl}/pay/${invoice.shareToken}?success=true`,
      cancel_url: `${siteUrl}/pay/${invoice.shareToken}?canceled=true`,
      metadata: {
        invoice_id: invoice.id,
        org_id: invoice.organizationId || "",
        share_token: invoice.shareToken,
        invoice_number: invoice.invoiceNumber,
      },
    });

    if (session.url) {
      return {
        status: "success",
        provider: "stripe",
        checkoutUrl: session.url,
      };
    }
  } catch (err: any) {
    console.error("[payments] Stripe Checkout error:", err?.message || err);
    return {
      status: "error",
      error: err?.message || "Failed to initiate online checkout session.",
    };
  }

  return null;
}
