"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const COUNTRIES = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["FR", "France"],
] as const;

export function TestCheckoutForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Ada Lovelace",
    email: "ada@example.com",
    line1: "1 Analytical Engine Way",
    line2: "",
    city: "London",
    state: "",
    postalCode: "SW1A 1AA",
    country: "GB",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress: {
            name: form.name,
            email: form.email,
            line1: form.line1,
            line2: form.line2 || null,
            city: form.city,
            state: form.state || null,
            postalCode: form.postalCode,
            country: form.country,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error === "cart_empty" ? "Your cart is empty." : "Could not place the test order.");
      }

      const { orderId, guestAccessToken } = await res.json();
      router.push(`/orders/${orderId}?token=${guestAccessToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-3">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        No payment is collected here — this creates a real order (fulfillment
        handoff + notifications included) for testing. Disabled in
        production.
      </div>

      <input
        value={form.name}
        onChange={(e) => update("name", e.target.value)}
        placeholder="Full name"
        required
        className="w-full rounded border border-neutral-300 p-2 text-sm"
      />
      <input
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        type="email"
        placeholder="Email"
        required
        className="w-full rounded border border-neutral-300 p-2 text-sm"
      />
      <input
        value={form.line1}
        onChange={(e) => update("line1", e.target.value)}
        placeholder="Address line 1"
        required
        className="w-full rounded border border-neutral-300 p-2 text-sm"
      />
      <input
        value={form.line2}
        onChange={(e) => update("line2", e.target.value)}
        placeholder="Address line 2 (optional)"
        className="w-full rounded border border-neutral-300 p-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          value={form.city}
          onChange={(e) => update("city", e.target.value)}
          placeholder="City"
          required
          className="rounded border border-neutral-300 p-2 text-sm"
        />
        <input
          value={form.state}
          onChange={(e) => update("state", e.target.value)}
          placeholder="State / region"
          className="rounded border border-neutral-300 p-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          value={form.postalCode}
          onChange={(e) => update("postalCode", e.target.value)}
          placeholder="Postal code"
          required
          className="rounded border border-neutral-300 p-2 text-sm"
        />
        <select
          value={form.country}
          onChange={(e) => update("country", e.target.value)}
          className="rounded border border-neutral-300 p-2 text-sm"
        >
          {COUNTRIES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
      >
        {submitting ? "Placing order…" : "Place test order (no payment)"}
      </button>
    </form>
  );
}
