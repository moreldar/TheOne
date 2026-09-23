import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const styles = [
  { slug: "watercolor", name: "Watercolor", colors: ["#a8d8ea", "#7bb8d4"] },
  { slug: "oil-painting", name: "Oil Painting", colors: ["#c9a876", "#8b6f47"] },
  { slug: "pop-art", name: "Pop Art", colors: ["#ff6b9d", "#ffd93d"] },
  { slug: "anime", name: "Anime", colors: ["#a78bfa", "#f472b6"] },
  { slug: "classic-cartoon", name: "Classic Cartoon", colors: ["#fbbf24", "#fb923c"] },
  { slug: "pencil-sketch", name: "Pencil Sketch", colors: ["#d1d5db", "#9ca3af"] },
  { slug: "charcoal-drawing", name: "Charcoal Drawing", colors: ["#6b7280", "#374151"] },
  { slug: "renaissance", name: "Renaissance", colors: ["#d4af37", "#8b5e3c"] },
  { slug: "cyberpunk", name: "Cyberpunk", colors: ["#06b6d4", "#a21caf"] },
  { slug: "fantasy", name: "Fantasy", colors: ["#818cf8", "#34d399"] },
  { slug: "vintage-photograph", name: "Vintage Photograph", colors: ["#e7d4b5", "#a68a64"] },
  { slug: "minimalist-line-art", name: "Minimalist Line Art", colors: ["#f3f4f6", "#d1d5db"] },
];

async function run() {
  const outDir = path.join(__dirname, "..", "public", "style-thumbnails");
  for (const style of styles) {
    const svg = `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${style.colors[0]}"/>
            <stop offset="100%" stop-color="${style.colors[1]}"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <text x="50%" y="50%" font-family="sans-serif" font-size="28" font-weight="bold"
              fill="white" text-anchor="middle" dominant-baseline="middle">${style.name}</text>
      </svg>`;
    const outPath = path.join(outDir, `${style.slug}.jpg`);
    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(outPath);
    console.log("generated", outPath);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
