import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";

const GUEST_SESSION_COOKIE = "mc_guest_session";
const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Every visitor — logged in or not — gets a stable guest session id used to
 * scope cart items, rate-limit free generations, and let a guest revisit
 * their own uploads. It's independent of auth so it keeps working across
 * login/logout.
 */
export async function getOrCreateGuestSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  cookieStore.set(GUEST_SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return id;
}

export async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  return headerList.get("x-real-ip");
}
