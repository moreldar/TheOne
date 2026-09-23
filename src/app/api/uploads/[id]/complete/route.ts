import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicUrlFor } from "@/lib/storage";
import { getModerationProvider } from "@/lib/providers/moderation";
import { track } from "@/lib/analytics/track";
import { getOrCreateGuestSessionId } from "@/lib/session";

/**
 * Called by the client once the browser has finished PUT-ing the file to
 * the presigned storage URL. Confirms the object exists (implicitly, by
 * trusting the client here — a stricter implementation would HEAD the
 * object) and runs the pre-upload moderation check.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guestSessionId = await getOrCreateGuestSessionId();

  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const publicUrl = publicUrlFor(upload.storageKey);

  const moderation = await getModerationProvider().check({
    imageUrl: publicUrl,
    context: "upload",
  });

  const updated = await prisma.upload.update({
    where: { id },
    data: {
      publicUrl,
      moderationStatus: moderation.approved ? "APPROVED" : "REJECTED",
      moderationNotes: moderation.reasons.join(", ") || null,
    },
  });

  await track({
    name: "upload_completed",
    guestSessionId,
    properties: { uploadId: id, moderationStatus: updated.moderationStatus },
  });

  return NextResponse.json({
    uploadId: updated.id,
    moderationStatus: updated.moderationStatus,
    publicUrl: updated.publicUrl,
  });
}
