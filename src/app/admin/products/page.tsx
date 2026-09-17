import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

async function toggleActive(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const product = await prisma.product.findUniqueOrThrow({ where: { id } });
  await prisma.product.update({ where: { id }, data: { active: !product.active } });
  revalidatePath("/admin/products");
}

async function createProduct(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await prisma.product.create({
    data: {
      name,
      slug,
      fulfillmentProviderSku: (formData.get("fulfillmentProviderSku") as string) || null,
      printWidthIn: Number(formData.get("printWidthIn")),
      printHeightIn: Number(formData.get("printHeightIn")),
      baseCostCents: Math.round(Number(formData.get("baseCost")) * 100),
      priceCents: Math.round(Number(formData.get("price")) * 100),
    },
  });
  revalidatePath("/admin/products");
}

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Products</h1>

      <div className="space-y-2">
        {products.map((product) => (
          <div key={product.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm">
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-neutral-500">
                {product.printWidthIn}x{product.printHeightIn}in · cost ${(product.baseCostCents / 100).toFixed(2)} ·
                price ${(product.priceCents / 100).toFixed(2)}
              </p>
            </div>
            <form action={toggleActive}>
              <input type="hidden" name="id" value={product.id} />
              <button
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  product.active ? "border border-green-600 text-green-700" : "border border-neutral-300 text-neutral-500"
                }`}
              >
                {product.active ? "Active" : "Inactive"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 font-medium">Add a new product</h2>
      <form action={createProduct} className="grid max-w-lg grid-cols-2 gap-2">
        <input name="name" placeholder="Name" required className="col-span-2 rounded border border-neutral-300 p-2 text-sm" />
        <input
          name="fulfillmentProviderSku"
          placeholder="Fulfillment SKU (optional)"
          className="col-span-2 rounded border border-neutral-300 p-2 text-sm"
        />
        <input name="printWidthIn" type="number" step="0.01" placeholder="Width (in)" required className="rounded border border-neutral-300 p-2 text-sm" />
        <input name="printHeightIn" type="number" step="0.01" placeholder="Height (in)" required className="rounded border border-neutral-300 p-2 text-sm" />
        <input name="baseCost" type="number" step="0.01" placeholder="Base cost ($)" required className="rounded border border-neutral-300 p-2 text-sm" />
        <input name="price" type="number" step="0.01" placeholder="Price ($)" required className="rounded border border-neutral-300 p-2 text-sm" />
        <button className="col-span-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Add product
        </button>
      </form>
    </div>
  );
}
