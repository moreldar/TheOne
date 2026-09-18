import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createOrderFromCart } from "@/lib/orders/createOrderFromCart";

// Stripe webhooks need the raw body for signature verification, so this
// route must not run through any JSON body-parsing middleware.
export const runtime = "nodejs";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const guestSessionId = session.metadata?.guestSessionId ?? null;
  const cartItemIds: string[] = session.metadata?.cartItemIds
    ? JSON.parse(session.metadata.cartItemIds)
    : [];

  const shipping = session.shipping_details ?? null;
  const address = shipping?.address ?? session.customer_details?.address ?? null;

  await createOrderFromCart({
    cartItemIds,
    guestSessionId,
    guestEmail: session.customer_details?.email ?? null,
    shippingName: shipping?.name ?? session.customer_details?.name ?? "Unknown",
    shippingLine1: address?.line1 ?? "",
    shippingLine2: address?.line2 ?? null,
    shippingCity: address?.city ?? "",
    shippingState: address?.state ?? null,
    shippingPostalCode: address?.postal_code ?? "",
    shippingCountry: address?.country ?? "",
    paymentReference: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    shippingCents: session.shipping_cost?.amount_total ?? 0,
    taxCents: session.total_details?.amount_tax ?? 0,
  });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
  } catch (err) {
    console.error(`[webhook] failed to handle event ${event.id} (${event.type})`, err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
