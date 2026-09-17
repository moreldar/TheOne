import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getClientIp, getOrCreateGuestSessionId } from "@/lib/session";
import { buildUploadKey, getPresignedUploadUrl } from "@/lib/storage";
import { createUploadSchema } from "@/lib/validation";
import { track } from "@/lib/analytics/track";

export async function POST(request: NextRequest) {
  const session = await auth();
  const guestSessionId = await getOrCreateGuestSessionId();
  const ipAddress = await getClientIp();

  const body = await request.json().catch(() => null);
  const parsed = createUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { filename, mimeType, fileSizeBytes, width, height, consentGiven, ageConfirmed18 } =
    parsed.data;

  if (
    width &&
    height &&
    (width < config.upload.minWidthPx || height < config.upload.minHeightPx)
  ) {
    return NextResponse.json(
      {
        error: "resolution_too_low",
        message: `Please upload a photo at least ${config.upload.minWidthPx}x${config.upload.minHeightPx}px.`,
      },
      { status: 400 },
    );
  }

  const storageKey = buildUploadKey(filename, guestSessionId);
  const uploadUrl = await getPresignedUploadUrl(storageKey, mimeType);

  const upload = await prisma.upload.create({
    data: {
      userId: session?.user ? (session.user as { id: string }).id : null,
      guestSessionId,
      ipAddress,
      storageKey,
      mimeType,
      fileSizeBytes,
      width,
      height,
      consentGiven,
      ageConfirmed18,
      moderationStatus: "PENDING",
    },
  });

  await track({
    name: "upload_started",
    guestSessionId,
    userId: session?.user ? (session.user as { id: string }).id : null,
    properties: { uploadId: upload.id, mimeType },
  });

  return NextResponse.json({ uploadId: upload.id, uploadUrl, storageKey });
}
