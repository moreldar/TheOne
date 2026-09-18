"use client";

import type { Style } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NOTE_MAX_LENGTH = 150;

export function StyleSelector({
  uploadId,
  styles,
  sourceImageUrl,
}: {
  uploadId: string;
  styles: Style[];
  sourceImageUrl: string | null;
}) {
  const router = useRouter();
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!selectedStyleId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, styleId: selectedStyleId, userNote: note || null }),
      });

      if (res.status === 429) {
        const body = await res.json();
        setError(body.message ?? "Free preview limit reached.");
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        throw new Error("Could not start generation. Please try again.");
      }

      const { generationId } = await res.json();
      router.push(`/generate/${generationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      {sourceImageUrl && (
        <div className="mb-8 flex justify-center">
          <Image
            src={sourceImageUrl}
            alt="Your uploaded photo"
            width={160}
            height={160}
            className="rounded-lg object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {styles.map((style) => (
          <button
            key={style.id}
            onClick={() => setSelectedStyleId(style.id)}
            className={`rounded-lg border-2 p-3 text-left transition ${
              selectedStyleId === style.id
                ? "border-neutral-900 bg-neutral-50"
                : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <div className="mb-2 aspect-square w-full rounded bg-neutral-100">
              {style.thumbnailUrl && (
                <Image
                  src={style.thumbnailUrl}
                  alt={style.name}
                  width={200}
                  height={200}
                  className="h-full w-full rounded object-cover"
                  unoptimized
                />
              )}
            </div>
            <p className="text-sm font-medium">{style.name}</p>
            <p className="text-xs text-neutral-500">{style.category}</p>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <label htmlFor="note" className="mb-1 block text-sm font-medium">
          Add a short note (optional)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          maxLength={NOTE_MAX_LENGTH}
          rows={2}
          placeholder="e.g. warmer color tones, add a soft blue background"
          className="w-full rounded-lg border border-neutral-300 p-3 text-sm"
        />
        <p className="mt-1 text-right text-xs text-neutral-400">
          {note.length}/{NOTE_MAX_LENGTH}
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={!selectedStyleId || submitting}
        className="mt-4 w-full rounded-full bg-neutral-900 py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Starting…" : "Generate preview"}
      </button>
    </div>
  );
}
