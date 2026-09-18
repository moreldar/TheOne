import sharp from "sharp";

const PREVIEW_MAX_WIDTH = 900;

function watermarkSvg(width: number, height: number): Buffer {
  const label = "MEMORYCANVAS PREVIEW";
  const tile = 260;
  const rows = Math.ceil(height / tile) + 1;
  const cols = Math.ceil(width / tile) + 1;

  let texts = "";
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * tile;
      const y = row * tile;
      texts += `<text x="${x}" y="${y}" transform="rotate(-30 ${x} ${y})" font-size="22" font-family="sans-serif" fill="white" fill-opacity="0.35">${label}</text>`;
    }
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${texts}</svg>`;
  return Buffer.from(svg);
}

/**
 * Downscales the full-resolution generation output and tiles a
 * translucent watermark across it, so the preview can be shown pre-purchase
 * without exposing anything print-ready.
 */
export async function buildWatermarkedPreview(sourceBuffer: Buffer): Promise<Buffer> {
  const resized = sharp(sourceBuffer).resize({
    width: PREVIEW_MAX_WIDTH,
    withoutEnlargement: true,
  });

  const metadata = await resized.metadata();
  const width = metadata.width ?? PREVIEW_MAX_WIDTH;
  const height = metadata.height ?? PREVIEW_MAX_WIDTH;

  return resized
    .composite([{ input: watermarkSvg(width, height), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
