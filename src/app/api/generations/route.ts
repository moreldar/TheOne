import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkGenerationCap } from "@/lib/rateLimit";
import { getClientIp, getOrCreateGuestSessionId } from "@/lib/session";
import { enqueueGeneration } from "@/lib/queue/generationQueue";
import { createGenerationSchema } from "@/lib/validation";
import { track } from "@/lib/analytics/track";

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  const guestSessionId = await getOrCreateGuestSessionId();
  const ipAddress = await getClientIp();

  const body = await request.json().catch(() => null);
  const parsed = createGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cap = await checkGenerationCap(guestSessionId, ipAddress, userId);
  if (!cap.allowed) {
    return NextResponse.json(
      {
        error: "generation_cap_reached",
        message: "You've used all your free previews. Please sign in with your email to continue.",
        requiresEmailCapture: true,
      },
      { status: 429 },
    );
  }

  const { uploadId, styleId, userNote } = parsed.data;

  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    return NextResponse.json({ error: "upload_not_found" }, { status: 404 });
  }
  if (upload.moderationStatus !== "APPROVED") {
    return NextResponse.json({ error: "upload_not_approved" }, { status: 400 });
  }

  const style = await prisma.style.findUnique({ where: { id: styleId } });
  if (!style || !style.active) {
    return NextResponse.json({ error: "style_not_found" }, { status: 404 });
  }

  const generation = await prisma.generation.create({
    data: {
      userId,
      uploadId,
      styleId,
      userNote: userNote?.trim() || null,
      status: "QUEUED",
      guestSessionId,
      ipAddress,
    },
  });

  await enqueueGeneration({
    generationId: generation.id,
    uploadId,
    styleId,
    userNote: userNote?.trim() || null,
  });

  await track({
    name: "generation_requested",
    guestSessionId,
    userId,
    properties: { generationId: generation.id, styleId, uploadId },
  });

  return NextResponse.json({ generationId: generation.id });
}
