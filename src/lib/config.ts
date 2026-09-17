/**
 * Central, env-driven configuration. Nothing funnel-behavioral should be
 * hardcoded deep in route/component logic — read it from here so it's a
 * single adjustable surface.
 */

function int(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  /** Max free AI generations allowed per guest session/IP before we require email capture. */
  freeGenerationCap: int("FREE_GENERATION_CAP", 5),

  /** Max regenerate attempts allowed for a single upload+style combo before nudging a new photo/style. */
  maxRegeneratesPerUpload: int("MAX_REGENERATES_PER_UPLOAD", 5),

  upload: {
    maxFileSizeBytes: int("UPLOAD_MAX_FILE_SIZE_BYTES", 20 * 1024 * 1024), // 20MB
    minWidthPx: int("UPLOAD_MIN_WIDTH_PX", 512),
    minHeightPx: int("UPLOAD_MIN_HEIGHT_PX", 512),
    allowedMimeTypes: ["image/jpeg", "image/png", "image/heic", "image/heif"],
  },

  userNoteMaxLength: int("USER_NOTE_MAX_LENGTH", 150),

  generation: {
    maxAttempts: int("GENERATION_MAX_ATTEMPTS", 3),
    backoffBaseMs: int("GENERATION_BACKOFF_BASE_MS", 2000),
  },

  admin: {
    emails: (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  },

  providers: {
    generation: process.env.GENERATION_PROVIDER ?? "mock",
    moderation: process.env.MODERATION_PROVIDER ?? "passthrough",
    fulfillment: process.env.FULFILLMENT_PROVIDER ?? "stub",
    notification: process.env.NOTIFICATION_PROVIDER ?? "console",
  },
};
