import { describe, expect, it } from "vitest";
import { buildGeminiMetadata } from "./gemini";

describe("buildGeminiMetadata", () => {
  it("normalizes Gemini usage metadata into token usage", () => {
    const metadata = buildGeminiMetadata({
      model: "gemini-test",
      durationMs: 12.6,
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
        cachedContentTokenCount: 1,
        thoughtsTokenCount: 2,
        toolUsePromptTokenCount: 3,
        trafficType: "ON_DEMAND"
      }
    });

    expect(metadata).toMatchObject({
      provider: "gemini",
      model: "gemini-test",
      operation: "prescription_analysis",
      durationMs: 13,
      tokenUsage: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
        cachedContentTokenCount: 1,
        thoughtsTokenCount: 2,
        toolUsePromptTokenCount: 3
      },
      rawUsageMetadata: {
        trafficType: "ON_DEMAND"
      }
    });
  });

  it("ignores non-numeric token fields", () => {
    const metadata = buildGeminiMetadata({
      model: "gemini-test",
      durationMs: -4,
      usageMetadata: {
        promptTokenCount: "10",
        totalTokenCount: 15
      }
    });

    expect(metadata.durationMs).toBe(0);
    expect(metadata.tokenUsage.promptTokenCount).toBeUndefined();
    expect(metadata.tokenUsage.totalTokenCount).toBe(15);
  });
});