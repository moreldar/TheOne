import { config } from "@/lib/config";
import { MockGenerationProvider } from "./mockProvider";
import type { GenerationProvider } from "./types";

export * from "./types";

let cached: GenerationProvider | undefined;

/**
 * Provider selection is env-driven (`GENERATION_PROVIDER`) so switching
 * from the mock to a real provider — or from a primary to a fallback — is
 * a config change, not a code change at call sites.
 */
export function getGenerationProvider(): GenerationProvider {
  if (cached) return cached;

  switch (config.providers.generation) {
    case "mock":
      cached = new MockGenerationProvider();
      break;
    // TODO(real-integration): case "qwen": cached = new QwenImageEditProvider(); break;
    // TODO(real-integration): case "gemini": cached = new GeminiImageProvider(); break;
    default:
      console.warn(
        `[generation] Unknown GENERATION_PROVIDER "${config.providers.generation}", falling back to mock.`,
      );
      cached = new MockGenerationProvider();
  }

  return cached;
}
