import { randomUUID } from "crypto";
import type {
  FulfillmentOrderInput,
  FulfillmentOrderResult,
  FulfillmentProvider,
} from "./types";

/**
 * Logs the fulfillment request and immediately "accepts" it with a fake
 * provider order id, so the Order status machine can progress
 * (PAID -> IN_PRODUCTION) without a real print vendor connected.
 *
 * TODO(real-integration): replace with Printful's Order Create API
 * (POST /orders, auth via PRINTFUL_API_KEY, store id via
 * PRINTFUL_STORE_ID). Map `FulfillmentOrderItemInput.productSku` /
 * `variantId` to Printful catalog variant ids, and `printFileUrl` to the
 * `files: [{ url }]` field. Printful's shipment/tracking webhooks should
 * feed back into `Order.fulfillmentStatus` / `trackingNumber` /
 * `trackingUrl` — see src/app/api/webhooks (add a printful route
 * alongside the stripe one) once wired in.
 */
export class StubFulfillmentProvider implements FulfillmentProvider {
  readonly name = "stub";

  async submitOrder(input: FulfillmentOrderInput): Promise<FulfillmentOrderResult> {
    console.log(`[fulfillment] Stub-submitting order ${input.orderId} to print provider`, {
      itemCount: input.items.length,
      shipTo: `${input.shippingAddress.city}, ${input.shippingAddress.country}`,
    });

    return {
      providerOrderId: `stub_${randomUUID()}`,
      status: "accepted",
    };
  }
}
