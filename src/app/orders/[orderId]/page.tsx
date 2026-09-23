import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Payment pending",
  PAID: "Order confirmed",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orderId } = await params;
  const { token } = await searchParams;
  const session = await auth();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) notFound();

  const userId = session?.user ? (session.user as { id: string }).id : null;
  const isOwner = userId && order.userId === userId;
  const hasValidToken = token && order.guestAccessToken && token === order.guestAccessToken;

  if (!isOwner && !hasValidToken) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">Order not found</h1>
        <p className="mt-2 text-neutral-600">
          Check the link from your confirmation email, or sign in to view your orders.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">Order #{order.id.slice(-8).toUpperCase()}</h1>
      <p className="mt-1 text-neutral-600">
        Status: <span className="font-medium">{STATUS_LABELS[order.status] ?? order.status}</span>
      </p>

      {order.trackingNumber && (
        <p className="mt-2 text-sm">
          Tracking:{" "}
          {order.trackingUrl ? (
            <a href={order.trackingUrl} className="underline">
              {order.trackingNumber}
            </a>
          ) : (
            order.trackingNumber
          )}
        </p>
      )}

      <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{item.productName}</p>
              <p className="text-sm text-neutral-500">Qty {item.quantity}</p>
            </div>
            <p className="font-medium">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency }).format(
                (item.unitPriceCents * item.quantity) / 100,
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between text-sm text-neutral-600">
        <span>Subtotal</span>
        <span>{(order.subtotalCents / 100).toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm text-neutral-600">
        <span>Shipping</span>
        <span>{(order.shippingCents / 100).toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm text-neutral-600">
        <span>Tax</span>
        <span>{(order.taxCents / 100).toFixed(2)}</span>
      </div>
      <div className="mt-1 flex justify-between border-t border-neutral-200 pt-2 font-semibold">
        <span>Total</span>
        <span>{(order.totalCents / 100).toFixed(2)}</span>
      </div>

      <div className="mt-6 text-sm text-neutral-600">
        <p className="font-medium text-neutral-900">Shipping to</p>
        <p>{order.shippingName}</p>
        <p>{order.shippingLine1}</p>
        {order.shippingLine2 && <p>{order.shippingLine2}</p>}
        <p>
          {order.shippingCity}, {order.shippingState} {order.shippingPostalCode}
        </p>
        <p>{order.shippingCountry}</p>
      </div>
    </div>
  );
}
