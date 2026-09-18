import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getOrCreateGuestSessionId } from "@/lib/session";
import { track, type AnalyticsEventName } from "@/lib/analytics/track";

// Only events that legitimately originate client-side (post-render user
// actions) are accepted here — funnel milestones that happen server-side
// (upload_started, generation_requested, ...) are tracked directly from
// their API routes instead.
const CLIENT_EVENT_NAMES: AnalyticsEventName[] = [
  "preview_viewed",
  "regenerate_clicked",
  "added_to_cart",
  "checkout_started",
];

const bodySchema = z.object({
  name: z.enum(CLIENT_EVENT_NAMES as [AnalyticsEventName, ...AnalyticsEventName[]]),
  properties: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const session = await auth();
  const guestSessionId = await getOrCreateGuestSessionId();

  await track({
    name: parsed.data.name,
    guestSessionId,
    userId: session?.user ? (session.user as { id: string }).id : null,
    properties: parsed.data.properties,
  });

  return NextResponse.json({ ok: true });
}
