import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const generation = await prisma.generation.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      previewUrl: true,
      errorMessage: true,
      uploadId: true,
      styleId: true,
      moderationStatus: true,
      attempts: true,
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(generation);
}
