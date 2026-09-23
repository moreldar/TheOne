import { prisma } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [pendingModeration, ordersPending, ordersInProduction, totalGenerations] =
    await Promise.all([
      prisma.upload.count({ where: { moderationStatus: "PENDING" } }),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
      prisma.generation.count(),
    ]);

  const stats = [
    { label: "Uploads awaiting moderation", value: pendingModeration },
    { label: "Orders paid, awaiting production", value: ordersPending },
    { label: "Orders in production", value: ordersInProduction },
    { label: "Total generations", value: totalGenerations },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-neutral-200 p-4">
          <p className="text-2xl font-semibold">{stat.value}</p>
          <p className="text-sm text-neutral-500">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
