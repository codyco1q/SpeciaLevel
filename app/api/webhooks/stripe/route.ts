import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { dispatchNotificationToOrgAdmins } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Stripe configuration is missing on the server." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed:", err?.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err?.message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;
    const orgId = session.metadata?.org_id;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    if (invoiceId) {
      const supabase = createServiceRoleClient();
      const { data: updated, error } = await supabase.rpc(
        "mark_invoice_as_paid_by_provider",
        {
          p_invoice_id: invoiceId,
          p_provider: "stripe",
          p_intent_id: paymentIntentId,
        }
      );

      if (error) {
        console.error(
          "[stripe-webhook] mark_invoice_as_paid_by_provider failed:",
          error.message
        );
      } else {
        const invoiceData = updated as {
          id?: string;
          invoiceNumber?: string;
          organizationId?: string;
          total?: number | string;
          currency?: string;
        } | null;

        const invoiceNumber =
          invoiceData?.invoiceNumber || session.metadata?.invoice_number || "Invoice";
        const currency = (invoiceData?.currency || session.currency || "USD").toUpperCase();
        const total = Number(invoiceData?.total) || (session.amount_total ? session.amount_total / 100 : 0);
        const formattedTotal = `${currency} ${total.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

        const targetOrgId = orgId || invoiceData?.organizationId;

        if (targetOrgId) {
          await dispatchNotificationToOrgAdmins({
            orgId: targetOrgId,
            title: "Invoice Paid",
            message: `Invoice ${invoiceNumber} (${formattedTotal}) has been paid via Stripe Checkout.`,
            type: "invoice",
            link: `/invoicing/${invoiceId}`,
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
