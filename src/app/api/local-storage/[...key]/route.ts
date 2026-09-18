import { NextRequest, NextResponse } from "next/server";
import { isLocalStorage } from "@/lib/storage/client";
import { writeLocalObject } from "@/lib/storage/localProvider";

/**
 * Stand-in for a presigned S3 PUT URL when STORAGE_PROVIDER="local". Only
 * active in that mode — disabled otherwise so it's never a surprise write
 * path in an environment that's actually configured for real storage.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  if (!isLocalStorage()) {
    return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  }

  const { key } = await params;
  const body = Buffer.from(await request.arrayBuffer());

  await writeLocalObject(key.join("/"), body);

  return NextResponse.json({ ok: true });
}
