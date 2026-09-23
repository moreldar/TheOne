import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductPicker } from "@/components/ProductPicker";

export default async function ProductSelectionPage({
  params,
}: {
  params: Promise<{ generationId: string }>;
}) {
  const { generationId } = await params;

  const generation = await prisma.generation.findUnique({ where: { id: generationId } });
  if (!generation || generation.status !== "SUCCEEDED") notFound();

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <h1 className="mb-2 text-center text-2xl font-semibold">Choose your product</h1>
      <p className="mb-8 text-center text-neutral-600">
        This portrait can go on more than one product — add as many as you&apos;d like.
      </p>
      <ProductPicker
        generationId={generationId}
        previewUrl={generation.previewUrl}
        products={products}
      />
    </div>
  );
}
