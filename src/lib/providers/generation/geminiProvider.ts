import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerationInput, GenerationProvider, GenerationResult } from "./types";
import { GenerationProviderError } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash-image";

/**
 * Real image-to-image editing via Gemini's image-output model ("Nano
 * Banana"). Sends the source photo + the style's resolved prompt in one
 * request and asks for an image back.
 *
 * Needs GEMINI_API_KEY (get one at https://aistudio.google.com/apikey).
 * Model is configurable via GEMINI_IMAGE_MODEL for when a newer image
 * model replaces this one.
 */
export class GeminiImageProvider implements GenerationProvider {
  readonly name = "gemini";
  private client: GoogleGenAI | undefined;

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GenerationProviderError(
        "GEMINI_API_KEY is not set — get one at https://aistudio.google.com/apikey",
        false,
      );
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    const sourceResponse = await fetch(input.sourceImageUrl);
    if (!sourceResponse.ok) {
      throw new GenerationProviderError(
        `Failed to fetch source image: ${sourceResponse.status}`,
        true,
      );
    }
    const sourceMimeType = sourceResponse.headers.get("content-type") ?? "image/jpeg";
    const sourceArrayBuffer = await sourceResponse.arrayBuffer();
    const sourceBase64 = Buffer.from(sourceArrayBuffer).toString("base64");

    const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

    let response;
    try {
      response = await this.getClient().models.generateContent({
        model,
        contents: [
          { text: input.prompt },
          { inlineData: { data: sourceBase64, mimeType: sourceMimeType } },
        ],
        config: { responseModalities: [Modality.IMAGE] },
      });
    } catch (err) {
      // The SDK's ApiError carries an HTTP-style status; treat rate
      // limits and server errors as retryable, anything else (bad
      // request, auth, content policy) as not.
      const status = (err as { status?: number })?.status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      throw new GenerationProviderError(
        `Gemini API error: ${err instanceof Error ? err.message : String(err)}`,
        retryable,
        err,
      );
    }

    const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);
    const imageData = imagePart?.inlineData?.data;

    if (!imageData) {
      // The model responded but produced no image — most likely a safety
      // refusal on the prompt or photo. Retrying the identical request
      // won't help.
      const textPart = response.candidates?.[0]?.content?.parts?.find((part) => part.text);
      throw new GenerationProviderError(
        `Gemini returned no image${textPart?.text ? `: ${textPart.text}` : " (possible content policy refusal)"}`,
        false,
      );
    }

    return {
      imageBuffer: Buffer.from(imageData, "base64"),
      providerName: this.name,
    };
  }
}
