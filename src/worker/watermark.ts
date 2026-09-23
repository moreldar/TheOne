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
 * Applies the source image's EXIF orientation to the actual pixels, then
 * strips the tag. Phone cameras store pixel data in a fixed sensor
 * orientation and rely on this tag for viewers to display it upright;
 * sharp (like most server-side image processing) doesn't apply it
 * automatically. Without this, a photo that looks correct in every
 * browser (which do respect the tag) comes out sideways or upside down
 * once it's gone through sharp — including the full-resolution file a
 * customer actually pays to have printed, not just the preview.
 */
export async function normalizeOrientation(sourceBuffer: Buffer): Promise<Buffer> {
  return sharp(sourceBuffer).rotate().toBuffer();
}

/**
 * Downscales the full-resolution generation output and tiles a
 * translucent watermark across it, so the preview can be shown pre-purchase
 * without exposing anything print-ready.
 */
export async function buildWatermarkedPreview(sourceBuffer: Buffer): Promise<Buffer> {
  // sharp's .metadata() reflects the *input* image, not a pending resize —
  // calling it on a not-yet-resized pipeline silently returns the
  // original (often much larger) dimensions. Building the watermark SVG
  // from those then fails compositing onto the actually-resized image
  // ("Image to composite must have same dimensions or smaller"). Resize
  // to a real buffer first, then read *that* buffer's metadata.
  //
  // .rotate() here is a defensive no-op when the caller already
  // normalized orientation (sharp strips the EXIF tag once applied) —
  // kept so this function is correct even if called with a raw buffer.
  const resizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
    .toBuffer();

  const metadata = await sharp(resizedBuffer).metadata();
  const width = metadata.width ?? PREVIEW_MAX_WIDTH;
  const height = metadata.height ?? PREVIEW_MAX_WIDTH;

  return sharp(resizedBuffer)
    .composite([{ input: watermarkSvg(width, height), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
