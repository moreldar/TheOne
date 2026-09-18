"use client";

/** Fire-and-forget client-side funnel event tracking. */
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, properties }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never break the UI it's observing.
  });
}
