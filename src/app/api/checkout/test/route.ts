import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { getOrCreateGuestSessionId } from "@/lib/session";
import { checkoutSchema } from "@/lib/validation";
import { createOrderFromCart } from "@/lib/orders/createOrderFromCart";
import { track } from "@/lib/analytics/track";

/**
 * Dev-only stand-in for Stripe Checkout: places a real Order — same
 * fulfillment handoff, same notifications, same order-status page — using
 * a form-collected shipping address instead of a hosted Stripe payment
 * page, and no money moves. Exists purely so the funnel can be tested
 * end-to-end before a Stripe account is wired in. Disabled whenever
 * NODE_ENV is "production", which Next.js sets automatically for
 * `next build`/`next start` regardless of what's in .env.
 */
export async function POST(request: NextRequest) {
  if (!config.isDevelopment) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

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

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { shippingAddress } = parsed.data;

  await track({
    name: "checkout_started",
    guestSessionId,
    properties: { paymentReference: "dev_test", itemCount: cartItems.length },
  });

  const order = await createOrderFromCart({
    cartItemIds: cartItems.map((item) => item.id),
    guestSessionId,
    guestEmail: shippingAddress.email,
    shippingName: shippingAddress.name,
    shippingLine1: shippingAddress.line1,
    shippingLine2: shippingAddress.line2 ?? null,
    shippingCity: shippingAddress.city,
    shippingState: shippingAddress.state ?? null,
    shippingPostalCode: shippingAddress.postalCode,
    shippingCountry: shippingAddress.country,
    paymentReference: `dev_test_${randomUUID()}`,
    stripePaymentIntentId: null,
  });

  if (!order) {
    return NextResponse.json({ error: "order_creation_failed" }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id, guestAccessToken: order.guestAccessToken });
}
