import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3-compatible object storage client. Defaults to Cloudflare R2; switch to
 * AWS S3 (or any other S3-compatible provider) purely via env vars — no
 * code changes needed.
 *
 * STORAGE_PROVIDER="local" is a third option, dev/test only: it writes to
 * the Next.js `public/` folder instead of calling S3, so the funnel can be
 * exercised end-to-end without real cloud storage credentials. See
 * src/lib/storage/localProvider.ts. It is never a reasonable choice in
 * production (files live on the app server's local disk, not a CDN).
 */
export function isLocalStorage(): boolean {
  return process.env.STORAGE_PROVIDER === "local";
}

let client: S3Client | undefined;

export function getStorageClient(): S3Client {
  if (client) return client;

  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION ?? "auto";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY ?? "";

  client = new S3Client({
    region,
    endpoint,
    // R2 (and many S3-compatible providers) require path-style addressing.
    forcePathStyle: (process.env.STORAGE_PROVIDER ?? "r2") === "r2",
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export const buckets = {
  uploads: () => process.env.STORAGE_BUCKET_UPLOADS ?? "memorycanvas-uploads",
  generations: () => process.env.STORAGE_BUCKET_GENERATIONS ?? "memorycanvas-generations",
};

export function publicUrlFor(bucketKey: string): string {
  const key = bucketKey.replace(/^\//, "");
  if (isLocalStorage()) {
    // Served straight out of Next's public/ folder — see localProvider.ts.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${appUrl.replace(/\/$/, "")}/${key}`;
  }
  const cdnBase = process.env.STORAGE_PUBLIC_CDN_URL ?? "";
  return `${cdnBase.replace(/\/$/, "")}/${key}`;
}
