import { CartClient } from "@/components/CartClient";
import { config } from "@/lib/config";

export default function CartPage() {
  return (
    <div>
      <h1 className="mb-8 text-center text-2xl font-semibold">Your cart</h1>
      <CartClient />
      {config.isDevelopment && (
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-neutral-400">
          No Stripe key yet?{" "}
          <a href="/checkout/test" className="underline hover:text-neutral-600">
            Use the test checkout
          </a>{" "}
          to place a real order without payment.
        </p>
      )}
    </div>
  );
}
