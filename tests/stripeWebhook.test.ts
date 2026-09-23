import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const orderCreate = vi.fn();
const orderUpdate = vi.fn();
const cartItemFindMany = vi.fn();
const cartItemDeleteMany = vi.fn();
const productFindMany = vi.fn();
const constructEvent = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { create: (...args: unknown[]) => orderCreate(...args), update: (...args: unknown[]) => orderUpdate(...args) },
    cartItem: {
      findMany: (...args: unknown[]) => cartItemFindMany(...args),
      deleteMany: (...args: unknown[]) => cartItemDeleteMany(...args),
    },
    product: { findMany: (...args: unknown[]) => productFindMany(...args) },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: (...args: unknown[]) => constructEvent(...args) },
  },
}));

vi.mock("@/lib/providers/fulfillment", () => ({
  getFulfillmentProvider: () => ({
    submitOrder: vi.fn().mockResolvedValue({ providerOrderId: "stub_1", status: "accepted" }),
  }),
}));

vi.mock("@/lib/providers/notification", () => ({
  getNotificationProvider: () => ({ send: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@/lib/storage", () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://cdn.example.com/signed"),
}));

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn().mockResolvedValue(undefined) }));

const CART_ITEM = {
  id: "cart_1",
  productId: "product_1",
  quantity: 1,
  product: { id: "product_1", name: "Canvas Print", priceCents: 5999, currency: "usd" },
  generation: { printMasterStorageKey: "generations/gen_1/print-master.png" },
};

const STRIPE_SESSION = {
  id: "cs_test_123",
  amount_total: 5999,
  payment_intent: "pi_123",
  shipping_details: {
    name: "Jane Doe",
    address: {
      line1: "123 Main St",
      line2: null,
      city: "Springfield",
      state: "IL",
      postal_code: "62704",
      country: "US",
    },
  },
  customer_details: { email: "jane@example.com", name: "Jane Doe", address: null },
  shipping_cost: { amount_total: 0 },
  total_details: { amount_tax: 0 },
  metadata: {
    guestSessionId: "guest_1",
    cartItemIds: JSON.stringify(["cart_1"]),
  },
};

function buildRequest() {
  return {
    headers: { get: (key: string) => (key === "stripe-signature" ? "sig_test" : null) },
    text: async () => JSON.stringify({ id: STRIPE_SESSION.id }),
  } as unknown as Parameters<typeof import("@/app/api/webhooks/stripe/route").POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  constructEvent.mockReturnValue({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: STRIPE_SESSION },
  });
  cartItemFindMany.mockResolvedValue([CART_ITEM]);
  productFindMany.mockResolvedValue([
    { id: "product_1", fulfillmentProviderSku: "SKU_1", fulfillmentVariantId: null, printWidthIn: 16, printHeightIn: 20 },
  ]);
});

describe("Stripe webhook idempotency", () => {
  it("creates exactly one order on the first delivery", async () => {
    orderCreate.mockResolvedValue({
      id: "order_1",
      guestAccessToken: "tok",
      items: [{ id: "oi_1", productId: "product_1", printMasterStorageKey: CART_ITEM.generation.printMasterStorageKey, quantity: 1 }],
    });
    orderUpdate.mockImplementation(async ({ data }) => ({
      id: "order_1",
      guestEmail: "jane@example.com",
      shippingName: "Jane Doe",
      shippingLine1: "123 Main St",
      shippingLine2: null,
      shippingCity: "Springfield",
      shippingState: "IL",
      shippingPostalCode: "62704",
      shippingCountry: "US",
      guestAccessToken: "tok",
      items: [{ id: "oi_1", productId: "product_1", printMasterStorageKey: CART_ITEM.generation.printMasterStorageKey, quantity: 1 }],
      ...data,
    }));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(cartItemDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("does not create a second order when the webhook is retried", async () => {
    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`stripeCheckoutSessionId`)",
      { code: "P2002", clientVersion: "5.22.0" },
    );
    orderCreate.mockRejectedValue(uniqueConstraintError);

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(orderCreate).toHaveBeenCalledTimes(1);
    // Because create failed with a duplicate, we must never proceed to
    // mark it paid, clear the cart, or hand off to fulfillment again.
    expect(orderUpdate).not.toHaveBeenCalled();
    expect(cartItemDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(buildRequest());

    expect(response.status).toBe(400);
    expect(orderCreate).not.toHaveBeenCalled();
  });
});
