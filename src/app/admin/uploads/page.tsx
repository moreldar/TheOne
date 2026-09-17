import { revalidatePath } from "next/cache";
import Image from "next/image";
import { prisma } from "@/lib/db";

async function approveUpload(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await prisma.upload.update({ where: { id }, data: { moderationStatus: "APPROVED" } });
  revalidatePath("/admin/uploads");
}

async function rejectUpload(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await prisma.upload.update({ where: { id }, data: { moderationStatus: "REJECTED" } });
  revalidatePath("/admin/uploads");
}

export default async function AdminUploadsPage() {
  const uploads = await prisma.upload.findMany({
    where: { moderationStatus: { in: ["PENDING", "REJECTED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Moderation queue</h1>
      <p className="mb-6 text-sm text-neutral-500">
        The active ModerationProvider ({process.env.MODERATION_PROVIDER ?? "passthrough"}) auto-approves
        uploads today — this queue is where a real provider&apos;s flags (or manual overrides) show up.
      </p>
      {uploads.length === 0 ? (
        <p className="text-neutral-500">Nothing needs review right now.</p>
      ) : (
        <div className="space-y-4">
          {uploads.map((upload) => (
            <div key={upload.id} className="flex items-center gap-4 rounded-lg border border-neutral-200 p-4">
              {upload.publicUrl && (
                <Image
                  src={upload.publicUrl}
                  alt="Upload"
                  width={64}
                  height={64}
                  className="rounded object-cover"
                  unoptimized
                />
              )}
              <div className="flex-1 text-sm">
                <p className="font-medium">{upload.id}</p>
                <p className="text-neutral-500">
                  Status: {upload.moderationStatus} · {upload.moderationNotes ?? "no notes"}
                </p>
              </div>
              <form action={approveUpload}>
                <input type="hidden" name="id" value={upload.id} />
                <button className="rounded-full border border-green-600 px-4 py-1 text-sm text-green-700">
                  Approve
                </button>
              </form>
              <form action={rejectUpload}>
                <input type="hidden" name="id" value={upload.id} />
                <button className="rounded-full border border-red-600 px-4 py-1 text-sm text-red-700">
                  Reject
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
