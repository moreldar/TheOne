import { config } from "@/lib/config";
import { TestCheckoutForm } from "@/components/TestCheckoutForm";

export default function TestCheckoutPage() {
  if (!config.isDevelopment) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">Not available</h1>
        <p className="mt-2 text-neutral-600">
          The no-payment test checkout is a development-only feature.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-center text-2xl font-semibold">Test checkout</h1>
      <TestCheckoutForm />
    </div>
  );
}
