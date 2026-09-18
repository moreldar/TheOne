import { describe, expect, it } from "vitest";
import { GenerationStatus } from "@prisma/client";
import {
  assertGenerationTransition,
  canTransitionGeneration,
  isTerminalGenerationStatus,
} from "@/lib/stateMachines/generationStatus";

describe("generation status state machine", () => {
  it("allows the happy path QUEUED -> PROCESSING -> SUCCEEDED", () => {
    expect(canTransitionGeneration(GenerationStatus.QUEUED, GenerationStatus.PROCESSING)).toBe(true);
    expect(canTransitionGeneration(GenerationStatus.PROCESSING, GenerationStatus.SUCCEEDED)).toBe(true);
  });

  it("allows PROCESSING -> FAILED", () => {
    expect(canTransitionGeneration(GenerationStatus.PROCESSING, GenerationStatus.FAILED)).toBe(true);
  });

  it("allows FAILED -> QUEUED for retries", () => {
    expect(canTransitionGeneration(GenerationStatus.FAILED, GenerationStatus.QUEUED)).toBe(true);
  });

  it("rejects skipping straight to SUCCEEDED from QUEUED", () => {
    expect(canTransitionGeneration(GenerationStatus.QUEUED, GenerationStatus.SUCCEEDED)).toBe(false);
  });

  it("rejects transitions out of a terminal SUCCEEDED state", () => {
    expect(canTransitionGeneration(GenerationStatus.SUCCEEDED, GenerationStatus.QUEUED)).toBe(false);
    expect(canTransitionGeneration(GenerationStatus.SUCCEEDED, GenerationStatus.FAILED)).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(canTransitionGeneration(GenerationStatus.QUEUED, GenerationStatus.QUEUED)).toBe(false);
  });

  it("throws on an invalid transition", () => {
    expect(() =>
      assertGenerationTransition(GenerationStatus.QUEUED, GenerationStatus.SUCCEEDED),
    ).toThrow(/Invalid Generation status transition/);
  });

  it("does not throw on a valid transition", () => {
    expect(() =>
      assertGenerationTransition(GenerationStatus.QUEUED, GenerationStatus.PROCESSING),
    ).not.toThrow();
  });

  it("identifies terminal statuses", () => {
    expect(isTerminalGenerationStatus(GenerationStatus.SUCCEEDED)).toBe(true);
    expect(isTerminalGenerationStatus(GenerationStatus.QUEUED)).toBe(false);
    expect(isTerminalGenerationStatus(GenerationStatus.PROCESSING)).toBe(false);
  });
});
