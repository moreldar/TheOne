import { prisma } from "@/lib/db";
import { config } from "@/lib/config";

export interface GenerationCapCheck {
  allowed: boolean;
  used: number;
  cap: number;
  requiresEmailCapture: boolean;
}

/**
 * Counts generations already requested by this guest session or IP and
 * compares against the configured free cap. Deliberately checks both
 * signals (session cookie + IP) so the cap can't be trivially bypassed by
 * clearing cookies — session id is still the primary key since IPs can be
 * shared (NAT, offices).
 */
export async function checkGenerationCap(
  guestSessionId: string,
  ipAddress: string | null,
  userId: string | null,
): Promise<GenerationCapCheck> {
  // Logged-in users with a verified email are not capped — email capture
  // has already happened.
  if (userId) {
    return { allowed: true, used: 0, cap: config.freeGenerationCap, requiresEmailCapture: false };
  }

  const usedBySession = await prisma.generation.count({
    where: { guestSessionId },
  });

  const usedByIp = ipAddress
    ? await prisma.generation.count({ where: { ipAddress } })
    : 0;

  const used = Math.max(usedBySession, usedByIp);
  const cap = config.freeGenerationCap;

  return {
    allowed: used < cap,
    used,
    cap,
    requiresEmailCapture: used >= cap,
  };
}
