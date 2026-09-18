import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateGuestSessionId } from "@/lib/session";
import { addToCartSchema } from "@/lib/validation";
import { track } from "@/lib/analytics/track";

export async function GET() {
  const session = await auth();
  const guestSessionId = await getOrCreateGuestSessionId();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  const items = await prisma.cartItem.findMany({
    where: userId ? { OR: [{ userId }, { guestSessionId }] } : { guestSessionId },
    include: { product: true, generation: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const guestSessionId = await getOrCreateGuestSessionId();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  const parsed = addToCartSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { generationId, productId, quantity } = parsed.data;

  const generation = await prisma.generation.findUnique({ where: { id: generationId } });
  if (!generation || generation.status !== "SUCCEEDED") {
    return NextResponse.json({ error: "generation_not_ready" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const cartItem = await prisma.cartItem.create({
    data: { guestSessionId, userId, generationId, productId, quantity },
  });

  await track({
    name: "added_to_cart",
    guestSessionId,
    userId,
    properties: { generationId, productId, quantity },
  });

  return NextResponse.json({ cartItem });
}
