import { Queue } from "bullmq";
import { config } from "@/lib/config";
import { getRedisConnection } from "./connection";

export const GENERATION_QUEUE_NAME = "generation";

export interface GenerationJobData {
  generationId: string;
  uploadId: string;
  styleId: string;
  userNote: string | null;
}

const globalForQueue = globalThis as unknown as {
  generationQueue?: Queue<GenerationJobData>;
};

export function getGenerationQueue(): Queue<GenerationJobData> {
  if (globalForQueue.generationQueue) return globalForQueue.generationQueue;

  const queue = new Queue<GenerationJobData>(GENERATION_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: config.generation.maxAttempts,
      backoff: {
        type: "exponential",
        delay: config.generation.backoffBaseMs,
      },
      removeOnComplete: { age: 60 * 60 * 24 }, // 1 day
      removeOnFail: { age: 60 * 60 * 24 * 7 }, // 1 week, keep for debugging
    },
  });

  globalForQueue.generationQueue = queue;
  return queue;
}

export async function enqueueGeneration(data: GenerationJobData) {
  const queue = getGenerationQueue();
  return queue.add("generate", data, { jobId: data.generationId });
}
