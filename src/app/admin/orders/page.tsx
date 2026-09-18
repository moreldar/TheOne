import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertOrderTransition } from "@/lib/stateMachines/orderStatus";
import { getNotificationProvider } from "@/lib/providers/notification";

async function markShipped(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const trackingNumber = (formData.get("trackingNumber") as string) || null;
  const trackingUrl = (formData.get("trackingUrl") as string) || null;

  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  assertOrderTransition(order.status, "SHIPPED");

  await prisma.order.update({
    where: { id },
    data: { status: "SHIPPED", trackingNumber, trackingUrl, shippedAt: new Date() },
  });

  if (order.guestEmail) {
    await getNotificationProvider().send({
      template: "order_shipped",
      to: order.guestEmail,
      data: { orderId: id, trackingNumber, trackingUrl },
    });
  }

  revalidatePath("/admin/orders");
}

async function markDelivered(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  assertOrderTransition(order.status, "DELIVERED");
  await prisma.order.update({
    where: { id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  revalidatePath("/admin/orders");
}

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border border-neutral-200 p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                #{order.id.slice(-8).toUpperCase()} — {order.guestEmail ?? "no email"}
              </p>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
                {order.status}
              </span>
            </div>
            <p className="mt-1 text-neutral-500">
              {order.items.length} item(s) · {(order.totalCents / 100).toFixed(2)} {order.currency.toUpperCase()}
            </p>
            {order.trackingNumber && (
              <p className="mt-1 text-neutral-500">Tracking: {order.trackingNumber}</p>
            )}

            {order.status === "IN_PRODUCTION" && (
              <form action={markShipped} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={order.id} />
                <input
                  name="trackingNumber"
                  placeholder="Tracking number"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                />
                <input
                  name="trackingUrl"
                  placeholder="Tracking URL"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                />
                <button className="rounded-full border border-neutral-900 px-3 py-1 text-xs font-medium">
                  Mark shipped
                </button>
              </form>
            )}

            {order.status === "SHIPPED" && (
              <form action={markDelivered} className="mt-3">
                <input type="hidden" name="id" value={order.id} />
                <button className="rounded-full border border-neutral-900 px-3 py-1 text-xs font-medium">
                  Mark delivered
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
