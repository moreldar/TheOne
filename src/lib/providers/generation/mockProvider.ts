import type { GenerationInput, GenerationProvider, GenerationResult } from "./types";

/**
 * Deterministic stand-in for a real image-generation model. Fetches the
 * source image and returns it unmodified (the API layer applies a
 * watermark on top for previews) so the rest of the pipeline — queue,
 * retries, storage, preview/print-master split — can be exercised
 * end-to-end without a real model.
 *
 * TODO(real-integration): replace with a call to either:
 *   1. A self-hosted Qwen-Image-Edit endpoint (primary) — POST the source
 *      image + prompt to QWEN_IMAGE_EDIT_ENDPOINT, auth via
 *      QWEN_IMAGE_EDIT_API_KEY, and parse the returned image bytes.
 *   2. Gemini / Nano Banana image API (fallback) — call it with
 *      GEMINI_API_KEY when the primary endpoint errors or times out.
 * Wire selection logic into `src/lib/providers/generation/index.ts`.
 */
export class MockGenerationProvider implements GenerationProvider {
  readonly name = "mock";

  async generate(input: GenerationInput): Promise<GenerationResult> {
    const response = await fetch(input.sourceImageUrl);
    if (!response.ok) {
      throw new Error(`Mock provider failed to fetch source image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Simulate model latency so the queued/processing UI states are visible.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      imageBuffer: Buffer.from(arrayBuffer),
      providerName: this.name,
    };
  }
}
