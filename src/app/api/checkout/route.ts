import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { config } from "@/lib/config";
import { getOrCreateGuestSessionId } from "@/lib/session";
import { track } from "@/lib/analytics/track";

// Stripe requires an explicit allow-list for shipping_address_collection —
// this is a reasonably broad starter set; extend as fulfillment expands.
const ALLOWED_SHIPPING_COUNTRIES: Array<
  import("stripe").Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry
> = ["US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "ES", "IT", "NL", "SE", "NO", "DK"];

export async function POST() {
  const guestSessionId = await getOrCreateGuestSessionId();

  const cartItems = await prisma.cartItem.findMany({
    where: { guestSessionId },
    include: { product: true, generation: true },
  });

  if (cartItems.length === 0) {
    return NextResponse.json({ error: "cart_empty" }, { status: 400 });
  }

  const invalidItem = cartItems.find((item) => item.generation.status !== "SUCCEEDED");
  if (invalidItem) {
    return NextResponse.json({ error: "generation_not_ready" }, { status: 400 });
  }

  const lineItems = cartItems.map((item) => ({
    price_data: {
      currency: item.product.currency,
      product_data: { name: item.product.name },
      unit_amount: item.product.priceCents,
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${config.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appUrl}/checkout/cancel`,
    shipping_address_collection: { allowed_countries: ALLOWED_SHIPPING_COUNTRIES },
    metadata: {
      guestSessionId,
      cartItemIds: JSON.stringify(cartItems.map((i) => i.id)),
    },
  });

  await track({
    name: "checkout_started",
    guestSessionId,
    properties: { stripeCheckoutSessionId: session.id, itemCount: cartItems.length },
  });

  return NextResponse.json({ url: session.url });
}
