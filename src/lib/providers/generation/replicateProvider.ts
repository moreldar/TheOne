import Replicate from "replicate";
import type { GenerationInput, GenerationProvider, GenerationResult } from "./types";
import { GenerationProviderError } from "./types";

/**
 * Runs an open-source image-editing model hosted on Replicate. This is a
 * hosted alternative to actually self-hosting Qwen-Image-Edit: same
 * family of open-source model, no GPU server required, pay-per-run
 * pricing instead of Google Cloud-style billing setup.
 *
 * Needs REPLICATE_API_TOKEN (https://replicate.com/account/api-tokens)
 * and REPLICATE_MODEL (default: qwen/qwen-image-edit-plus, confirmed
 * against its actual published schema — https://replicate.com/qwen/qwen-image-edit-plus/api).
 * Notably `image` is an *array* of URLs even for a single source image,
 * not a bare string. If you swap REPLICATE_MODEL for a different model,
 * check its own schema — the optional fields below (aspect_ratio,
 * output_format, go_fast) are specific to this one and an unfamiliar
 * model may reject them.
 */
export class ReplicateImageProvider implements GenerationProvider {
  readonly name = "replicate";
  private client: Replicate | undefined;

  private getClient(): Replicate {
    if (this.client) return this.client;
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      throw new GenerationProviderError(
        "REPLICATE_API_TOKEN is not set — get one at https://replicate.com/account/api-tokens",
        false,
      );
    }
    this.client = new Replicate({ auth: apiToken });
    return this.client;
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    const model = process.env.REPLICATE_MODEL || "qwen/qwen-image-edit-plus";
    if (!model.includes("/")) {
      throw new GenerationProviderError(
        `REPLICATE_MODEL is not a valid "owner/model-name": "${model}"`,
        false,
      );
    }

    let output: unknown;
    try {
      output = await this.getClient().run(model as `${string}/${string}`, {
        input: {
          image: [input.sourceImageUrl],
          prompt: input.prompt,
          aspect_ratio: "match_input_image",
          output_format: "png",
          go_fast: true,
        },
      });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      throw new GenerationProviderError(
        `Replicate API error: ${err instanceof Error ? err.message : String(err)}`,
        retryable,
        err,
      );
    }

    // Output shape varies per model: usually a single file, sometimes an
    // array of files (one per requested output).
    const fileOutput = Array.isArray(output) ? output[0] : output;
    if (!fileOutput) {
      throw new GenerationProviderError(
        "Replicate returned no output — the model's input schema may not match {image, prompt}; check the model's page on replicate.com",
        false,
      );
    }

    const imageUrl =
      typeof fileOutput === "string"
        ? fileOutput
        : (fileOutput as { url: () => URL }).url().toString();

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new GenerationProviderError(
        `Failed to fetch Replicate output image: ${imageResponse.status}`,
        true,
      );
    }

    return {
      imageBuffer: Buffer.from(await imageResponse.arrayBuffer()),
      providerName: this.name,
    };
  }
}
