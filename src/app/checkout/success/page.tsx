import { prisma } from "@/lib/db";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  const order = sessionId
    ? await prisma.order.findUnique({ where: { stripeCheckoutSessionId: sessionId } })
    : null;

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-semibold">Thank you for your order!</h1>
      {order ? (
        <>
          <p className="mt-2 text-neutral-600">
            A confirmation has been sent to {order.guestEmail ?? "your email"}.
          </p>
          <a
            href={`/orders/${order.id}?token=${order.guestAccessToken}`}
            className="mt-6 inline-block rounded-full bg-neutral-900 px-8 py-3 font-medium text-white"
          >
            View order status
          </a>
        </>
      ) : (
        <p className="mt-2 text-neutral-600">
          We&apos;re finalizing your order — this can take a few seconds. Check your email for confirmation.
        </p>
      )}
    </div>
  );
}
