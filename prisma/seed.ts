import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Prompt templates are placeholders — edit freely via /admin/styles once
// the real GenerationProvider is wired in. "{{userNote}}" is substituted
// with the customer's optional 150-char note (or removed if blank).
const styles = [
  {
    name: "Watercolor",
    slug: "watercolor",
    category: "Painterly",
    description: "Soft, dreamy watercolor portrait.",
    promptTemplate:
      "A soft watercolor painting portrait of the subject in the photo, gentle washes of color, visible paper texture, delicate linework. {{userNote}}",
    sortOrder: 1,
  },
  {
    name: "Oil Painting",
    slug: "oil-painting",
    category: "Painterly",
    description: "Classic fine-art oil portrait, rich brushwork.",
    promptTemplate:
      "A classical oil painting portrait of the subject, rich textured brushwork, warm gallery lighting, museum quality. {{userNote}}",
    sortOrder: 2,
  },
  {
    name: "Pop Art",
    slug: "pop-art",
    category: "Graphic",
    description: "Bold Warhol-style pop art.",
    promptTemplate:
      "A bold pop art portrait of the subject, high contrast, halftone dots, vivid saturated color blocks in the style of Andy Warhol. {{userNote}}",
    sortOrder: 3,
  },
  {
    name: "Anime",
    slug: "anime",
    category: "Illustrated",
    description: "Japanese anime-style illustration.",
    promptTemplate:
      "A Japanese anime-style illustrated portrait of the subject, clean cel-shaded line art, expressive eyes, vibrant colors. {{userNote}}",
    sortOrder: 4,
  },
  {
    name: "Classic Cartoon",
    slug: "classic-cartoon",
    category: "Illustrated",
    description: "Playful classic cartoon caricature.",
    promptTemplate:
      "A playful classic cartoon-style portrait of the subject, exaggerated friendly features, bold outlines, flat bright colors. {{userNote}}",
    sortOrder: 5,
  },
  {
    name: "Pencil Sketch",
    slug: "pencil-sketch",
    category: "Drawn",
    description: "Fine graphite pencil sketch.",
    promptTemplate:
      "A fine graphite pencil sketch portrait of the subject, detailed cross-hatching, soft shading, white background. {{userNote}}",
    sortOrder: 6,
  },
  {
    name: "Charcoal Drawing",
    slug: "charcoal-drawing",
    category: "Drawn",
    description: "Dramatic charcoal portrait.",
    promptTemplate:
      "A dramatic charcoal drawing portrait of the subject, deep contrast, expressive smudged shading, textured paper. {{userNote}}",
    sortOrder: 7,
  },
  {
    name: "Renaissance",
    slug: "renaissance",
    category: "Painterly",
    description: "Classical Renaissance-era portrait.",
    promptTemplate:
      "A Renaissance-era oil portrait of the subject in the style of the old masters, dramatic chiaroscuro lighting, ornate period clothing. {{userNote}}",
    sortOrder: 8,
  },
  {
    name: "Cyberpunk",
    slug: "cyberpunk",
    category: "Stylized",
    description: "Neon-lit cyberpunk portrait.",
    promptTemplate:
      "A cyberpunk-style portrait of the subject, neon lighting, futuristic city backdrop, high-tech accents, moody color grading. {{userNote}}",
    sortOrder: 9,
  },
  {
    name: "Fantasy",
    slug: "fantasy",
    category: "Stylized",
    description: "Epic fantasy character art.",
    promptTemplate:
      "An epic fantasy character portrait of the subject, painterly digital art, magical atmosphere, dramatic lighting. {{userNote}}",
    sortOrder: 10,
  },
  {
    name: "Vintage Photograph",
    slug: "vintage-photograph",
    category: "Photographic",
    description: "Sepia-toned vintage photo look.",
    promptTemplate:
      "A vintage sepia-toned photograph of the subject, film grain, soft focus, early 1900s studio portrait aesthetic. {{userNote}}",
    sortOrder: 11,
  },
  {
    name: "Minimalist Line Art",
    slug: "minimalist-line-art",
    category: "Graphic",
    description: "Single-line minimalist illustration.",
    promptTemplate:
      "A minimalist single continuous line art portrait of the subject, simple, elegant, monochrome on a plain background. {{userNote}}",
    sortOrder: 12,
  },
] as const;

const products = [
  {
    name: "Canvas Print (16x20)",
    slug: "canvas-print-16x20",
    fulfillmentProviderSku: "PRINTFUL_CANVAS_16x20", // TODO(real-integration): replace with real Printful variant id
    fulfillmentVariantId: null,
    printWidthIn: 16,
    printHeightIn: 20,
    dpiRequired: 150,
    bleedIn: 0.125,
    baseCostCents: 2500,
    priceCents: 5999,
    sortOrder: 1,
  },
  {
    name: "Photo Mug (11oz)",
    slug: "photo-mug-11oz",
    fulfillmentProviderSku: "PRINTFUL_MUG_11OZ", // TODO(real-integration): replace with real Printful variant id
    fulfillmentVariantId: null,
    printWidthIn: 8.2,
    printHeightIn: 3.4,
    dpiRequired: 150,
    bleedIn: 0.0625,
    baseCostCents: 700,
    priceCents: 2499,
    sortOrder: 2,
  },
] as const;

async function main() {
  for (const style of styles) {
    await prisma.style.upsert({
      where: { slug: style.slug },
      update: style,
      create: style,
    });
  }

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product,
    });
  }

  console.log(`Seeded ${styles.length} styles and ${products.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
