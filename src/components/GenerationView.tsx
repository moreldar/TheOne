"use client";

import type { GenerationStatus } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analyticsClient";

const POLL_INTERVAL_MS = 2000;

interface GenerationSnapshot {
  status: GenerationStatus;
  previewUrl: string | null;
  errorMessage: string | null;
}

export function GenerationView({
  generationId,
  uploadId,
  styleId,
  styleName,
  initialStatus,
  initialPreviewUrl,
  initialErrorMessage,
}: {
  generationId: string;
  uploadId: string;
  styleId: string;
  styleName: string;
  initialStatus: GenerationStatus;
  initialPreviewUrl: string | null;
  initialErrorMessage: string | null;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<GenerationSnapshot>({
    status: initialStatus,
    previewUrl: initialPreviewUrl,
    errorMessage: initialErrorMessage,
  });
  const [regenerating, setRegenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (snapshot.status === "SUCCEEDED" || snapshot.status === "FAILED") return;

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/generations/${generationId}`);
      if (!res.ok) return;
      const data = await res.json();
      setSnapshot({
        status: data.status,
        previewUrl: data.previewUrl,
        errorMessage: data.errorMessage,
      });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [generationId, snapshot.status]);

  useEffect(() => {
    if (snapshot.status === "SUCCEEDED") {
      trackEvent("preview_viewed", { generationId });
    }
  }, [snapshot.status, generationId]);

  async function handleRegenerate() {
    setRegenerating(true);
    trackEvent("regenerate_clicked", { generationId });
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, styleId, userNote: null }),
      });
      if (res.status === 429) {
        const body = await res.json();
        alert(body.message ?? "Free preview limit reached.");
        setRegenerating(false);
        return;
      }
      const { generationId: newId } = await res.json();
      router.push(`/generate/${newId}`);
    } catch {
      setRegenerating(false);
    }
  }

  if (snapshot.status === "QUEUED" || snapshot.status === "PROCESSING") {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 h-64 w-64 animate-pulse rounded-lg bg-neutral-200" />
        <h1 className="text-xl font-semibold">Creating your {styleName} portrait…</h1>
        <p className="mt-2 text-neutral-600">This usually takes under a minute.</p>
      </div>
    );
  }

  if (snapshot.status === "FAILED") {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t generate that preview</h1>
        <p className="mt-2 text-neutral-600">
          {snapshot.errorMessage ?? "Something went wrong."} Try a different photo or style.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a href={`/styles/${uploadId}`} className="rounded-full border border-neutral-300 px-6 py-2">
            Try another style
          </a>
          <a href="/upload" className="rounded-full border border-neutral-300 px-6 py-2">
            Upload a different photo
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="mb-4 text-xl font-semibold">Here&apos;s your {styleName} preview</h1>
      {snapshot.previewUrl && (
        <Image
          src={snapshot.previewUrl}
          alt="AI-generated preview"
          width={500}
          height={500}
          className="mx-auto rounded-lg object-cover"
          unoptimized
        />
      )}
      <p className="mt-3 text-xs text-neutral-400">
        Preview is watermarked. Your full-resolution print is unlocked after purchase.
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="rounded-full border border-neutral-300 px-6 py-2 disabled:opacity-40"
        >
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
        <a
          href={`/products/${generationId}`}
          className="rounded-full bg-neutral-900 px-6 py-2 font-medium text-white"
        >
          Add to cart
        </a>
      </div>
    </div>
  );
}
