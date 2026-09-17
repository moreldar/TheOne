import { randomUUID } from "crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buckets, getStorageClient, publicUrlFor } from "./client";

type BucketName = "uploads" | "generations";

/** Direct server-side upload (used by the worker — never by the browser). */
export async function putObject(
  bucket: BucketName,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = getStorageClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket === "uploads" ? buckets.uploads() : buckets.generations(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

const PRESIGNED_URL_TTL_SECONDS = 15 * 60;

export function buildUploadKey(originalFilename: string, guestSessionId: string): string {
  const ext = originalFilename.split(".").pop()?.toLowerCase() ?? "bin";
  return `uploads/${guestSessionId}/${randomUUID()}.${ext}`;
}

export function buildGenerationKey(
  generationId: string,
  variant: "preview" | "print-master",
): string {
  return `generations/${generationId}/${variant}.png`;
}

/** Presigned PUT URL the browser uploads directly to, so raw photo bytes never transit our server. */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const client = getStorageClient();
  const command = new PutObjectCommand({
    Bucket: buckets.uploads(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}

/**
 * Presigned GET for the print-master image — only ever generated after an
 * order is paid, and short-lived so the link can't be shared indefinitely.
 */
export async function getPresignedDownloadUrl(
  bucket: "uploads" | "generations",
  key: string,
): Promise<string> {
  const client = getStorageClient();
  const command = new GetObjectCommand({
    Bucket: bucket === "uploads" ? buckets.uploads() : buckets.generations(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
}

export { publicUrlFor };
