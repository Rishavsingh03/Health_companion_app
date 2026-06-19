import { describe, expect, it } from "vitest";
import { isUsableExtractedText, normalizeExtractedText } from "./pdf";

describe("PDF text helpers", () => {
  it("normalizes whitespace", () => {
    expect(normalizeExtractedText("  Tab   A\n\n500mg\t daily  ")).toBe("Tab A 500mg daily");
  });

  it("rejects empty or tiny extracted text", () => {
    expect(isUsableExtractedText("")).toBe(false);
    expect(isUsableExtractedText("Dolo 650")).toBe(false);
  });

  it("accepts sufficiently meaningful extracted text", () => {
    const text =
      "Tablet Metformin 500mg twice daily after meals for thirty days. Walk daily and follow a low sugar diet.";

    expect(isUsableExtractedText(text)).toBe(true);
  });
});

