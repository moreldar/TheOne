import { GenerationStatus } from "@prisma/client";

/**
 * Valid transitions for a Generation's lifecycle:
 *
 *   QUEUED -> PROCESSING -> SUCCEEDED
 *                        -> FAILED -> QUEUED (retry / regenerate)
 *
 * FAILED can go back to QUEUED because "regenerate" re-enqueues a fresh
 * attempt against the same Generation-adjacent record (in practice we
 * create a new Generation row per attempt at the API layer, but the state
 * machine itself supports either approach).
 */
const ALLOWED_TRANSITIONS: Record<GenerationStatus, GenerationStatus[]> = {
  [GenerationStatus.QUEUED]: [GenerationStatus.PROCESSING, GenerationStatus.FAILED],
  [GenerationStatus.PROCESSING]: [GenerationStatus.SUCCEEDED, GenerationStatus.FAILED],
  [GenerationStatus.SUCCEEDED]: [],
  [GenerationStatus.FAILED]: [GenerationStatus.QUEUED],
};

export function canTransitionGeneration(
  from: GenerationStatus,
  to: GenerationStatus,
): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertGenerationTransition(
  from: GenerationStatus,
  to: GenerationStatus,
): void {
  if (!canTransitionGeneration(from, to)) {
    throw new Error(`Invalid Generation status transition: ${from} -> ${to}`);
  }
}

export function isTerminalGenerationStatus(status: GenerationStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
