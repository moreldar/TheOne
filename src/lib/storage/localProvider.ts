import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Dev/test-only storage backend — see the note in client.ts. Writes land in
// the Next.js public/ folder so they're servable without any CDN.
const PUBLIC_DIR = path.join(process.cwd(), "public");

function assertSafeKey(key: string): void {
  if (key.includes("..") || path.isAbsolute(key)) {
    throw new Error(`Refusing to write outside public/: "${key}"`);
  }
}

export async function writeLocalObject(key: string, body: Buffer): Promise<void> {
  assertSafeKey(key);
  const filePath = path.join(PUBLIC_DIR, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

/** Target URL the browser PUTs the raw file bytes to for a local "presigned" upload. */
export function getLocalUploadUrl(key: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/api/local-storage/${key}`;
}
