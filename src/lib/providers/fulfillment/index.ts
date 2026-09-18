import { config } from "@/lib/config";
import { StubFulfillmentProvider } from "./stubProvider";
import type { FulfillmentProvider } from "./types";

export * from "./types";

let cached: FulfillmentProvider | undefined;

export function getFulfillmentProvider(): FulfillmentProvider {
  if (cached) return cached;

  switch (config.providers.fulfillment) {
    case "stub":
      cached = new StubFulfillmentProvider();
      break;
    // TODO(real-integration): case "printful": cached = new PrintfulFulfillmentProvider(); break;
    default:
      console.warn(
        `[fulfillment] Unknown FULFILLMENT_PROVIDER "${config.providers.fulfillment}", falling back to stub.`,
      );
      cached = new StubFulfillmentProvider();
  }

  return cached;
}
