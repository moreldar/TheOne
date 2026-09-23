import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    apiVersion: "2025-02-24.acacia",
  });

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}
