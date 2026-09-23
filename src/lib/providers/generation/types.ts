export interface GenerationInput {
  /** Publicly fetchable (or presigned) URL of the source photo. */
  sourceImageUrl: string;
  /** Fully-resolved prompt (style template + optional user note already merged). */
  prompt: string;
  styleId: string;
  generationId: string;
}

export interface GenerationResult {
  /** Raw image bytes of the generated output, full resolution. */
  imageBuffer: Buffer;
  /** Optional: provider-reported content-safety signal, if it does its own filtering. */
  flaggedUnsafe?: boolean;
  /** Provider name, for the `Generation.provider` audit field. */
  providerName: string;
}

export class GenerationProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GenerationProviderError";
  }
}

/**
 * Provider-agnostic interface for turning a source photo + style prompt
 * into a generated image. Implementations should throw
 * `GenerationProviderError` with `retryable: false` for permanent failures
 * (e.g. content policy rejection) so the worker doesn't waste retries.
 */
export interface GenerationProvider {
  readonly name: string;
  generate(input: GenerationInput): Promise<GenerationResult>;
}
