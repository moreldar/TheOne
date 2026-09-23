"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analyticsClient";

interface CartItemView {
  id: string;
  quantity: number;
  product: { id: string; name: string; priceCents: number; currency: string };
  generation: { id: string; previewUrl: string | null };
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function CartClient() {
  const [items, setItems] = useState<CartItemView[] | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCart() {
    const res = await fetch("/api/cart");
    const data = await res.json();
    setItems(data.items);
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function updateQuantity(id: string, quantity: number) {
    await fetch(`/api/cart/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    loadCart();
  }

  async function removeItem(id: string) {
    await fetch(`/api/cart/${id}`, { method: "DELETE" });
    loadCart();
  }

  async function handleCheckout() {
    setCheckingOut(true);
    setError(null);
    trackEvent("checkout_started");
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      if (!res.ok) throw new Error("Could not start checkout. Please try again.");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCheckingOut(false);
    }
  }

  if (!items) return <p className="text-center text-neutral-500">Loading your cart…</p>;

  if (items.length === 0) {
    return (
      <div className="text-center">
        <p className="text-neutral-600">Your cart is empty.</p>
        <a href="/upload" className="mt-4 inline-block underline">
          Start with a photo
        </a>
      </div>
    );
  }

  const subtotalCents = items.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0,
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 rounded-lg border border-neutral-200 p-4">
            {item.generation.previewUrl && (
              <Image
                src={item.generation.previewUrl}
                alt={item.product.name}
                width={80}
                height={80}
                className="rounded object-cover"
                unoptimized
              />
            )}
            <div className="flex-1">
              <p className="font-medium">{item.product.name}</p>
              <p className="text-sm text-neutral-500">
                {formatPrice(item.product.priceCents, item.product.currency)} each
              </p>
            </div>
            <select
              value={item.quantity}
              onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
              className="rounded border border-neutral-300 p-1 text-sm"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button onClick={() => removeItem(item.id)} className="text-sm text-neutral-400 hover:text-red-600">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-4">
        <span className="font-medium">Subtotal</span>
        <span className="font-semibold">{formatPrice(subtotalCents, "usd")}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-400">Shipping and tax calculated at checkout.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleCheckout}
        disabled={checkingOut}
        className="mt-6 w-full rounded-full bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
      >
        {checkingOut ? "Redirecting to checkout…" : "Checkout"}
      </button>
    </div>
  );
}
