export interface ModerationCheckInput {
  /** Publicly fetchable (or presigned) URL of the image to check. */
  imageUrl: string;
  context: "upload" | "generation-output";
}

export interface ModerationResult {
  approved: boolean;
  reasons: string[];
  /** Raw provider response, kept for audit/debugging. */
  raw?: unknown;
}

/**
 * Provider-agnostic content moderation. Called twice in the funnel:
 *   1. Pre-upload (on the raw photo, before it's eligible for generation)
 *   2. Post-generation (on the AI output, before it's shown as a preview)
 */
export interface ModerationProvider {
  readonly name: string;
  check(input: ModerationCheckInput): Promise<ModerationResult>;
}
