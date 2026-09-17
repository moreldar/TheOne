import { config } from "@/lib/config";
import { PassthroughModerationProvider } from "./passthroughProvider";
import type { ModerationProvider } from "./types";

export * from "./types";

let cached: ModerationProvider | undefined;

export function getModerationProvider(): ModerationProvider {
  if (cached) return cached;

  switch (config.providers.moderation) {
    case "passthrough":
      cached = new PassthroughModerationProvider();
      break;
    // TODO(real-integration): case "rekognition": cached = new RekognitionModerationProvider(); break;
    // TODO(real-integration): case "hive": cached = new HiveModerationProvider(); break;
    default:
      console.warn(
        `[moderation] Unknown MODERATION_PROVIDER "${config.providers.moderation}", falling back to passthrough.`,
      );
      cached = new PassthroughModerationProvider();
  }

  return cached;
}
