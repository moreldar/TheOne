"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MIN_DIMENSION_PX = 512;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [ageConfirmed18, setAgeConfirmed18] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const validateAndSetFile = useCallback((candidate: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(candidate.type)) {
      setError("Please upload a JPG, PNG, or HEIC photo.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      setError("That file is too large — please upload a photo under 20MB.");
      return;
    }
    setFile(candidate);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) validateAndSetFile(dropped);
    },
    [validateAndSetFile],
  );

  const canSubmit = file && consentGiven && ageConfirmed18 && !submitting;

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);

    try {
      const { width, height } = await readImageDimensions(file);
      if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
        setError(
          `This photo is too small (${width}x${height}px). Please use one at least ${MIN_DIMENSION_PX}x${MIN_DIMENSION_PX}px.`,
        );
        setSubmitting(false);
        return;
      }

      const createRes = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          width,
          height,
          consentGiven,
          ageConfirmed18,
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not start the upload. Please try again.");
      }

      const { uploadId, uploadUrl } = await createRes.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Upload to storage failed. Please try again.");
      }

      const completeRes = await fetch(`/api/uploads/${uploadId}/complete`, { method: "POST" });
      if (!completeRes.ok) {
        throw new Error("Could not finalize the upload. Please try again.");
      }
      const completed = await completeRes.json();

      if (completed.moderationStatus === "REJECTED") {
        setError(
          "This photo couldn't be approved for processing. Please try a different photo.",
        );
        setSubmitting(false);
        return;
      }

      router.push(`/styles/${uploadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
          dragActive ? "border-neutral-900 bg-neutral-50" : "border-neutral-300"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) validateAndSetFile(selected);
          }}
        />
        {file ? (
          <p className="font-medium">{file.name}</p>
        ) : (
          <>
            <p className="font-medium">Drag and drop a photo here</p>
            <p className="mt-1 text-sm text-neutral-500">or click to browse — JPG, PNG, HEIC, up to 20MB</p>
          </>
        )}
      </div>

      <div className="mt-6 space-y-3 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I have the right to upload this photo and consent to it being processed by AI.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={ageConfirmed18}
            onChange={(e) => setAgeConfirmed18(e.target.checked)}
            className="mt-0.5"
          />
          <span>I confirm that I am 18 years of age or older.</span>
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-6 w-full rounded-full bg-neutral-900 py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Uploading…" : "Continue"}
      </button>
    </div>
  );
}
