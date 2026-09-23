import type { ModerationCheckInput, ModerationProvider, ModerationResult } from "./types";

/**
 * Always approves. The `Upload.moderationStatus` / `Generation.moderationStatus`
 * fields and the UI blocking behavior around them are real — only the
 * actual content check is stubbed.
 *
 * TODO(real-integration): replace with one of:
 *   - AWS Rekognition `DetectModerationLabels` (AWS_REKOGNITION_* env vars) —
 *     good first choice, pay-per-call, no separate account needed beyond AWS.
 *   - Hive Moderation API (HIVE_MODERATION_API_KEY) — broader category
 *     coverage (e.g. more nuanced NSFW/violence categories), separate
 *     vendor account required.
 * Either implementation should map provider-specific label/score
 * thresholds to the `approved` boolean and populate `reasons` with
 * human-readable labels for the admin moderation queue.
 */
export class PassthroughModerationProvider implements ModerationProvider {
  readonly name = "passthrough";

  async check(input: ModerationCheckInput): Promise<ModerationResult> {
    console.warn(
      `[moderation] PassthroughModerationProvider auto-approving ${input.context} (${input.imageUrl}). ` +
        "Wire a real ModerationProvider before accepting real user traffic.",
    );
    return { approved: true, reasons: [] };
  }
}
