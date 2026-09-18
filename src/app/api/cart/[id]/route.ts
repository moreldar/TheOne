import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateGuestSessionId } from "@/lib/session";

const patchSchema = z.object({ quantity: z.number().int().min(1).max(20) });

async function assertOwnership(id: string, guestSessionId: string) {
  const item = await prisma.cartItem.findUnique({ where: { id } });
  if (!item || item.guestSessionId !== guestSessionId) return null;
  return item;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guestSessionId = await getOrCreateGuestSessionId();

  const item = await assertOwnership(id, guestSessionId);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const updated = await prisma.cartItem.update({
    where: { id },
    data: { quantity: parsed.data.quantity },
  });

  return NextResponse.json({ cartItem: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guestSessionId = await getOrCreateGuestSessionId();

  const item = await assertOwnership(id, guestSessionId);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.cartItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
