import "dotenv/config";
import { Job, Worker } from "bullmq";
import { prisma } from "../lib/db";
import { getRedisConnection } from "../lib/queue/connection";
import { GENERATION_QUEUE_NAME, type GenerationJobData } from "../lib/queue/generationQueue";
import { getGenerationProvider, GenerationProviderError } from "../lib/providers/generation";
import { getModerationProvider } from "../lib/providers/moderation";
import { buildGenerationKey, putObject, publicUrlFor } from "../lib/storage";
import { track } from "../lib/analytics/track";
import { buildWatermarkedPreview, normalizeOrientation } from "./watermark";

const CONCURRENCY = Number.parseInt(process.env.GENERATION_WORKER_CONCURRENCY ?? "3", 10);

function resolvePrompt(promptTemplate: string, userNote: string | null): string {
  const note = userNote?.trim() ? userNote.trim() : "";
  return promptTemplate.replace("{{userNote}}", note).trim();
}

async function processGenerationJob(job: Job<GenerationJobData>) {
  const { generationId, uploadId, styleId, userNote } = job.data;

  const generation = await prisma.generation.findUniqueOrThrow({ where: { id: generationId } });

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: "PROCESSING",
      processingAt: new Date(),
      attempts: job.attemptsMade + 1,
    },
  });

  const maxAttempts = job.opts.attempts ?? 1;

  try {
    const [upload, style] = await Promise.all([
      prisma.upload.findUniqueOrThrow({ where: { id: uploadId } }),
      prisma.style.findUniqueOrThrow({ where: { id: styleId } }),
    ]);

    if (!upload.publicUrl) {
      throw new GenerationProviderError("Upload has no public URL yet", false);
    }

    const prompt = resolvePrompt(style.promptTemplate, userNote);

    const result = await getGenerationProvider().generate({
      sourceImageUrl: upload.publicUrl,
      prompt,
      styleId,
      generationId,
    });

    // Normalize orientation once here so both the purchased print file and
    // the preview are upright, regardless of source-photo EXIF metadata.
    const orientedImage = await normalizeOrientation(result.imageBuffer);

    const printMasterKey = buildGenerationKey(generationId, "print-master");
    await putObject("generations", printMasterKey, orientedImage, "image/png");

    const previewBuffer = await buildWatermarkedPreview(orientedImage);
    const previewKey = buildGenerationKey(generationId, "preview");
    await putObject("generations", previewKey, previewBuffer, "image/png");
    const previewUrl = publicUrlFor(previewKey);

    const moderation = await getModerationProvider().check({
      imageUrl: previewUrl,
      context: "generation-output",
    });

    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: "SUCCEEDED",
        provider: result.providerName,
        previewStorageKey: previewKey,
        previewUrl,
        printMasterStorageKey: printMasterKey,
        moderationStatus: moderation.approved ? "APPROVED" : "REJECTED",
        moderationNotes: moderation.reasons.join(", ") || null,
        completedAt: new Date(),
      },
    });

    await track({
      name: "generation_succeeded",
      guestSessionId: generation.guestSessionId,
      userId: generation.userId,
      properties: { generationId, attempts: job.attemptsMade + 1 },
    });
  } catch (err) {
    const isPermanent = err instanceof GenerationProviderError && !err.retryable;
    const isFinalAttempt = isPermanent || job.attemptsMade + 1 >= maxAttempts;

    console.error(`[worker] generation ${generationId} attempt ${job.attemptsMade + 1} failed`, err);

    if (isFinalAttempt) {
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
          completedAt: new Date(),
        },
      });

      await track({
        name: "generation_failed",
        guestSessionId: generation.guestSessionId,
        userId: generation.userId,
        properties: { generationId, error: err instanceof Error ? err.message : String(err) },
      });
    }

    if (isPermanent) {
      // Don't let BullMQ retry a permanent failure.
      return;
    }
    throw err;
  }
}

const worker = new Worker<GenerationJobData>(GENERATION_QUEUE_NAME, processGenerationJob, {
  connection: getRedisConnection(),
  concurrency: CONCURRENCY,
});

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed permanently`, err);
});

console.log(`[worker] listening on queue "${GENERATION_QUEUE_NAME}" (concurrency=${CONCURRENCY})`);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
