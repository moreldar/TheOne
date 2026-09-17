import { prisma } from "@/lib/db";

/**
 * Funnel events we want visibility into. Keep this list in sync with the
 * spec's key steps — add new ones here rather than passing free-text event
 * names around the codebase.
 */
export type AnalyticsEventName =
  | "upload_started"
  | "upload_completed"
  | "generation_requested"
  | "generation_succeeded"
  | "generation_failed"
  | "preview_viewed"
  | "regenerate_clicked"
  | "added_to_cart"
  | "checkout_started"
  | "order_completed";

interface TrackParams {
  name: AnalyticsEventName;
  guestSessionId?: string | null;
  userId?: string | null;
  properties?: Record<string, unknown>;
}

/**
 * TODO(real-integration): forward to a real analytics tool (PostHog,
 * Amplitude, Segment, ...) in addition to / instead of the DB write. Call
 * sites never need to change — they just call track({ name, ... }).
 */
export async function track({ name, guestSessionId, userId, properties }: TrackParams) {
  console.log(`[analytics] ${name}`, { guestSessionId, userId, properties });

  try {
    await prisma.analyticsEvent.create({
      data: {
        name,
        guestSessionId: guestSessionId ?? null,
        userId: userId ?? null,
        properties: properties ? (properties as object) : undefined,
      },
    });
  } catch (err) {
    // Analytics must never break the funnel it's observing.
    console.error("[analytics] failed to persist event", err);
  }
}
