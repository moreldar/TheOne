export interface FulfillmentOrderItemInput {
  productSku: string;
  variantId: string | null;
  quantity: number;
  /** Presigned, time-limited URL to the full-resolution print master. */
  printFileUrl: string;
  printWidthIn: number;
  printHeightIn: number;
}

export interface FulfillmentShippingAddress {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
}

export interface FulfillmentOrderInput {
  orderId: string;
  items: FulfillmentOrderItemInput[];
  shippingAddress: FulfillmentShippingAddress;
}

export interface FulfillmentOrderResult {
  /** The provider's own order id, stored on `Order.fulfillmentProviderOrderId`. */
  providerOrderId: string;
  status: string;
}

/**
 * Provider-agnostic print-on-demand fulfillment handoff. Called once an
 * Order transitions to PAID.
 */
export interface FulfillmentProvider {
  readonly name: string;
  submitOrder(input: FulfillmentOrderInput): Promise<FulfillmentOrderResult>;
}
