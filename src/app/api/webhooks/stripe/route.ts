import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getFulfillmentProvider } from "@/lib/providers/fulfillment";
import { getNotificationProvider } from "@/lib/providers/notification";
import { getPresignedDownloadUrl } from "@/lib/storage";
import { assertOrderTransition } from "@/lib/stateMachines/orderStatus";
import { track } from "@/lib/analytics/track";

// Stripe webhooks need the raw body for signature verification, so this
// route must not run through any JSON body-parsing middleware.
export const runtime = "nodejs";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const guestSessionId = session.metadata?.guestSessionId ?? null;
  const cartItemIds: string[] = session.metadata?.cartItemIds
    ? JSON.parse(session.metadata.cartItemIds)
    : [];

  const cartItems = await prisma.cartItem.findMany({
    where: { id: { in: cartItemIds } },
    include: { product: true, generation: true },
  });

  if (cartItems.length === 0) {
    console.error(
      `[webhook] checkout.session.completed ${session.id} had no matching cart items (already processed or metadata missing)`,
    );
    return;
  }

  const shipping = session.shipping_details ?? null;
  const address = shipping?.address ?? session.customer_details?.address ?? null;
  const shippingName = shipping?.name ?? session.customer_details?.name ?? "Unknown";
  const guestEmail = session.customer_details?.email ?? null;

  const subtotalCents = cartItems.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0,
  );
  const totalCents = session.amount_total ?? subtotalCents;
  const shippingCents = session.shipping_cost?.amount_total ?? 0;
  const taxCents = session.total_details?.amount_tax ?? 0;

  let order;
  try {
    order = await prisma.order.create({
      data: {
        guestEmail,
        guestAccessToken: randomBytes(24).toString("hex"),
        status: "PENDING",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        shippingName,
        shippingLine1: address?.line1 ?? "",
        shippingLine2: address?.line2 ?? null,
        shippingCity: address?.city ?? "",
        shippingState: address?.state ?? null,
        shippingPostalCode: address?.postal_code ?? "",
        shippingCountry: address?.country ?? "",
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        items: {
          create: cartItems.map((item) => ({
            cartItemId: item.id,
            productId: item.productId,
            productName: item.product.name,
            unitPriceCents: item.product.priceCents,
            quantity: item.quantity,
            printMasterStorageKey: item.generation.printMasterStorageKey ?? "",
          })),
        },
      },
      include: { items: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.log(`[webhook] checkout.session.completed ${session.id} already processed, skipping`);
      return;
    }
    throw err;
  }

  assertOrderTransition("PENDING", "PAID");
  order = await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID", paidAt: new Date() },
    include: { items: true },
  });

  // Clean up the guest's cart now that it's been converted to an order.
  await prisma.cartItem.deleteMany({ where: { id: { in: cartItemIds } } });

  if (guestEmail) {
    await getNotificationProvider().send({
      template: "order_confirmed",
      to: guestEmail,
      data: { orderId: order.id, totalCents, guestAccessToken: order.guestAccessToken },
    });
  }

  await track({
    name: "order_completed",
    guestSessionId,
    properties: { orderId: order.id, totalCents },
  });

  // Hand off to fulfillment. In production this is where Printful (or
  // another POD provider) receives the print-ready file + shipping
  // address. Failures here should not fail the webhook response — Stripe
  // only cares that we acknowledged payment; fulfillment retry is a
  // separate concern (TODO: move to its own queue job for resilience).
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: order.items.map((item) => item.productId) } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    const items = await Promise.all(
      order.items.map(async (item) => {
        const product = productById.get(item.productId);
        return {
          productSku: product?.fulfillmentProviderSku ?? item.productId,
          variantId: product?.fulfillmentVariantId ?? null,
          quantity: item.quantity,
          printFileUrl: await getPresignedDownloadUrl("generations", item.printMasterStorageKey),
          printWidthIn: product?.printWidthIn ?? 0,
          printHeightIn: product?.printHeightIn ?? 0,
        };
      }),
    );

    const result = await getFulfillmentProvider().submitOrder({
      orderId: order.id,
      items,
      shippingAddress: {
        name: order.shippingName,
        line1: order.shippingLine1,
        line2: order.shippingLine2,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
      },
    });

    assertOrderTransition("PAID", "IN_PRODUCTION");
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "IN_PRODUCTION",
        fulfillmentProviderOrderId: result.providerOrderId,
        fulfillmentStatus: result.status,
      },
    });

    if (guestEmail) {
      await getNotificationProvider().send({
        template: "order_in_production",
        to: guestEmail,
        data: { orderId: order.id },
      });
    }
  } catch (err) {
    console.error(`[webhook] fulfillment handoff failed for order ${order.id}`, err);
  }
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
