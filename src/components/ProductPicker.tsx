"use client";

import type { Product } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackEvent } from "@/lib/analyticsClient";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function ProductPicker({
  generationId,
  previewUrl,
  products,
}: {
  generationId: string;
  previewUrl: string | null;
  products: Product[];
}) {
  const router = useRouter();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(productId: string) {
    setPendingProductId(productId);
    setError(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId, productId, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Could not add to cart. Please try again.");
      setAddedProductIds((prev) => [...prev, productId]);
      trackEvent("added_to_cart", { generationId, productId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingProductId(null);
    }
  }

  return (
    <div>
      {previewUrl && (
        <div className="mb-8 flex justify-center">
          <Image
            src={previewUrl}
            alt="Your AI-generated portrait"
            width={200}
            height={200}
            className="rounded-lg object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => {
          const added = addedProductIds.includes(product.id);
          return (
            <div key={product.id} className="rounded-lg border border-neutral-200 p-4">
              <h3 className="font-medium">{product.name}</h3>
              <p className="mt-1 text-lg font-semibold">
                {formatPrice(product.priceCents, product.currency)}
              </p>
              <button
                onClick={() => handleAdd(product.id)}
                disabled={pendingProductId === product.id}
                className="mt-3 w-full rounded-full border border-neutral-900 py-2 text-sm font-medium transition disabled:opacity-40"
              >
                {added ? "Added ✓" : pendingProductId === product.id ? "Adding…" : "Add to cart"}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {addedProductIds.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.push("/cart")}
            className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white"
          >
            Go to cart
          </button>
        </div>
      )}
    </div>
  );
}
