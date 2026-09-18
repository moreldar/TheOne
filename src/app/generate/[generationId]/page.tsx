import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GenerationView } from "@/components/GenerationView";

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ generationId: string }>;
}) {
  const { generationId } = await params;

  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    include: { style: true, upload: true },
  });
  if (!generation) notFound();

  return (
    <GenerationView
      generationId={generation.id}
      uploadId={generation.uploadId}
      styleId={generation.styleId}
      styleName={generation.style.name}
      initialStatus={generation.status}
      initialPreviewUrl={generation.previewUrl}
      initialErrorMessage={generation.errorMessage}
    />
  );
}
