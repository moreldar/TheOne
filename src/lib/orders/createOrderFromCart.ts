import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getFulfillmentProvider } from "@/lib/providers/fulfillment";
import { getNotificationProvider } from "@/lib/providers/notification";
import { getPresignedDownloadUrl } from "@/lib/storage";
import { assertOrderTransition } from "@/lib/stateMachines/orderStatus";
import { track } from "@/lib/analytics/track";

export interface CreateOrderFromCartInput {
  cartItemIds: string[];
  guestSessionId: string | null;
  guestEmail: string | null;
  shippingName: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingState: string | null;
  shippingPostalCode: string;
  shippingCountry: string;
  /**
   * Unique idempotency key for the order — a real Stripe Checkout Session
   * id in production, or a synthetic `dev_test_...` id for the no-payment
   * test checkout. Maps to `Order.stripeCheckoutSessionId`, whose unique
   * constraint is what makes this function safe to call twice with the
   * same reference (e.g. a retried webhook).
   */
  paymentReference: string;
  stripePaymentIntentId: string | null;
  /** Pre-tax/shipping subtotal is always computed from the cart; pass these to layer on top of it. */
  shippingCents?: number;
  taxCents?: number;
}

/**
 * Turns a guest's cart into a paid, in-production Order: creates the
 * Order + OrderItem snapshot, transitions PENDING -> PAID, clears the
 * converted cart items, fires the order_confirmed notification, hands off
 * to the FulfillmentProvider, and — on a successful handoff — transitions
 * PAID -> IN_PRODUCTION and fires order_in_production.
 *
 * Shared by the real Stripe webhook (src/app/api/webhooks/stripe) and the
 * dev-only no-payment test checkout (src/app/api/checkout/test), so both
 * paths exercise identical order/fulfillment/notification behavior — the
 * only difference is where the shipping address and payment reference
 * come from.
 *
 * Returns null (not an error) when `cartItemIds` resolve to nothing, which
 * covers both "already processed" (cart items were deleted by an earlier,
 * successful call) and a duplicate delivery of the same payment reference.
 */
export async function createOrderFromCart(input: CreateOrderFromCartInput) {
  const cartItems = await prisma.cartItem.findMany({
    where: { id: { in: input.cartItemIds } },
    include: { product: true, generation: true },
  });

  if (cartItems.length === 0) {
    console.log(
      `[orders] createOrderFromCart: no matching cart items for payment reference ${input.paymentReference} (already processed, or a bad reference)`,
    );
    return null;
  }

  const subtotalCents = cartItems.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0,
  );
  const shippingCents = input.shippingCents ?? 0;
  const taxCents = input.taxCents ?? 0;
  const totalCents = subtotalCents + shippingCents + taxCents;

  let order;
  try {
    order = await prisma.order.create({
      data: {
        guestEmail: input.guestEmail,
        guestAccessToken: randomBytes(24).toString("hex"),
        status: "PENDING",
        stripeCheckoutSessionId: input.paymentReference,
        stripePaymentIntentId: input.stripePaymentIntentId,
        shippingName: input.shippingName,
        shippingLine1: input.shippingLine1,
        shippingLine2: input.shippingLine2,
        shippingCity: input.shippingCity,
        shippingState: input.shippingState,
        shippingPostalCode: input.shippingPostalCode,
        shippingCountry: input.shippingCountry,
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
      console.log(
        `[orders] createOrderFromCart: payment reference ${input.paymentReference} already has an order, skipping`,
      );
      return null;
    }
    throw err;
  }

  assertOrderTransition("PENDING", "PAID");
  order = await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID", paidAt: new Date() },
    include: { items: true },
  });

  await prisma.cartItem.deleteMany({ where: { id: { in: input.cartItemIds } } });

  if (input.guestEmail) {
    await getNotificationProvider().send({
      template: "order_confirmed",
      to: input.guestEmail,
      data: { orderId: order.id, totalCents, guestAccessToken: order.guestAccessToken },
    });
  }

  await track({
    name: "order_completed",
    guestSessionId: input.guestSessionId,
    properties: { orderId: order.id, totalCents },
  });

  // Fulfillment handoff failures should not fail order creation — Stripe
  // (or, for the test path, the customer) only cares that the order was
  // placed. TODO: move this to its own retryable queue job for resilience.
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
    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "IN_PRODUCTION",
        fulfillmentProviderOrderId: result.providerOrderId,
        fulfillmentStatus: result.status,
      },
      include: { items: true },
    });

    if (input.guestEmail) {
      await getNotificationProvider().send({
        template: "order_in_production",
        to: input.guestEmail,
        data: { orderId: order.id },
      });
    }
  } catch (err) {
    console.error(`[orders] fulfillment handoff failed for order ${order.id}`, err);
  }

  return order;
}
