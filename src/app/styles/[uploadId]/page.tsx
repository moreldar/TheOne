import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { StyleSelector } from "@/components/StyleSelector";

export default async function StyleSelectionPage({
  params,
}: {
  params: Promise<{ uploadId: string }>;
}) {
  const { uploadId } = await params;

  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) notFound();

  if (upload.moderationStatus === "REJECTED") {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-semibold">This photo couldn&apos;t be used</h1>
        <p className="mt-2 text-neutral-600">
          Please go back and try a different photo.
        </p>
        <a href="/upload" className="mt-6 inline-block underline">
          Upload another photo
        </a>
      </div>
    );
  }

  if (upload.moderationStatus === "PENDING") {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-semibold">Still checking your photo…</h1>
        <p className="mt-2 text-neutral-600">This usually takes a few seconds. Refresh in a moment.</p>
      </div>
    );
  }

  const styles = await prisma.style.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <h1 className="mb-2 text-center text-2xl font-semibold">Pick a style</h1>
      <p className="mb-8 text-center text-neutral-600">
        Choose the art style for your portrait. You can regenerate if it&apos;s not quite right.
      </p>
      <StyleSelector uploadId={uploadId} styles={styles} sourceImageUrl={upload.publicUrl} />
    </div>
  );
}
