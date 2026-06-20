import { describe, expect, it } from "vitest";
import { aiAnalysisSchema, loginSchema } from "./schemas";

describe("auth schemas", () => {
  it("normalizes login email", () => {
    const parsed = loginSchema.parse({
      email: "USER@Example.COM",
      password: "password123"
    });

    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects short passwords", () => {
    expect(() =>
      loginSchema.parse({
        email: "user@example.com",
        password: "short"
      })
    ).toThrow();
  });
});

describe("aiAnalysisSchema", () => {
  it("accepts the expected structured analysis shape", () => {
    const parsed = aiAnalysisSchema.parse({
      patientSummary: "Patient has a prescription that should be verified with a clinician.",
      clinicalMetadata: {
        deducedSpecialty: "General Medicine"
      },
      medicines: [
        {
          name: "Example",
          originalRawText: "Exampel",
          correctedName: "Example"
        }
      ],
      doctorAdvice: ["Take after food"],
      recognizedConditions: ["Fever"],
      lifestyleRecommendations: ["Rest"],
      warnings: ["Confirm dosage with doctor"],
      uncertaintyNotes: ["Handwriting unclear"],
      disclaimer:
        "CRITICAL: This is an AI-generated summary for informational purposes only and is not medical advice. Please verify these medications with a licensed professional."
    });

    expect(parsed.medicines).toHaveLength(1);
  });
});