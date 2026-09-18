import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

async function toggleActive(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const style = await prisma.style.findUniqueOrThrow({ where: { id } });
  await prisma.style.update({ where: { id }, data: { active: !style.active } });
  revalidatePath("/admin/styles");
}

async function createStyle(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await prisma.style.create({
    data: {
      name,
      slug,
      category: (formData.get("category") as string) || "General",
      promptTemplate: formData.get("promptTemplate") as string,
      thumbnailUrl: (formData.get("thumbnailUrl") as string) || null,
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    },
  });
  revalidatePath("/admin/styles");
}

export default async function AdminStylesPage() {
  const styles = await prisma.style.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Styles</h1>

      <div className="space-y-2">
        {styles.map((style) => (
          <div key={style.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm">
            <div>
              <p className="font-medium">
                {style.name} <span className="text-neutral-400">({style.category})</span>
              </p>
              <p className="mt-1 max-w-xl truncate text-xs text-neutral-500">{style.promptTemplate}</p>
            </div>
            <form action={toggleActive}>
              <input type="hidden" name="id" value={style.id} />
              <button
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  style.active ? "border border-green-600 text-green-700" : "border border-neutral-300 text-neutral-500"
                }`}
              >
                {style.active ? "Active" : "Inactive"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 font-medium">Add a new style</h2>
      <form action={createStyle} className="grid max-w-lg gap-2">
        <input name="name" placeholder="Name" required className="rounded border border-neutral-300 p-2 text-sm" />
        <input name="category" placeholder="Category" className="rounded border border-neutral-300 p-2 text-sm" />
        <input
          name="thumbnailUrl"
          placeholder="Thumbnail URL (optional)"
          className="rounded border border-neutral-300 p-2 text-sm"
        />
        <textarea
          name="promptTemplate"
          placeholder="Prompt template — include {{userNote}} where the customer's note should go"
          required
          rows={2}
          className="rounded border border-neutral-300 p-2 text-sm"
        />
        <input
          name="sortOrder"
          type="number"
          placeholder="Sort order"
          className="rounded border border-neutral-300 p-2 text-sm"
        />
        <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Add style
        </button>
      </form>
    </div>
  );
}
