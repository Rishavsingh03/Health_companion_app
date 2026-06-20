import { performance } from "node:perf_hooks";
import { env } from "../config";
import { aiAnalysisSchema, type AiAnalysis } from "../schemas";

type AnalyzePrescriptionInput = {
  symptoms: string;
  extractedText?: string;
  files?: Array<{
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
  }>;
};

export type GeminiTokenUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  toolUsePromptTokenCount?: number;
};

export type GeminiAnalysisMetadata = {
  provider: "gemini";
  model: string;
  operation: "prescription_analysis";
  durationMs: number;
  tokenUsage: GeminiTokenUsage;
  rawUsageMetadata?: Record<string, unknown>;
};

type AnalyzePrescriptionResult = {
  analysis: AiAnalysis;
  metadata?: GeminiAnalysisMetadata;
};

function readNumber(value: Record<string, unknown> | undefined, key: keyof GeminiTokenUsage) {
  const candidate = value?.[key];
  return typeof candidate === "number" ? candidate : undefined;
}

export function buildGeminiMetadata(input: {
  model: string;
  durationMs: number;
  usageMetadata?: Record<string, unknown> | null;
}): GeminiAnalysisMetadata {
  const rawUsageMetadata = input.usageMetadata
    ? Object.fromEntries(Object.entries(input.usageMetadata))
    : undefined;

  return {
    provider: "gemini",
    model: input.model,
    operation: "prescription_analysis",
    durationMs: Math.max(0, Math.round(input.durationMs)),
    tokenUsage: {
      promptTokenCount: readNumber(rawUsageMetadata, "promptTokenCount"),
      candidatesTokenCount: readNumber(rawUsageMetadata, "candidatesTokenCount"),
      totalTokenCount: readNumber(rawUsageMetadata, "totalTokenCount"),
      cachedContentTokenCount: readNumber(rawUsageMetadata, "cachedContentTokenCount"),
      thoughtsTokenCount: readNumber(rawUsageMetadata, "thoughtsTokenCount"),
      toolUsePromptTokenCount: readNumber(rawUsageMetadata, "toolUsePromptTokenCount")
    },
    rawUsageMetadata
  };
}

function buildResponseSchema(Type: Record<string, string>) {
  return {
    type: Type.OBJECT,
    properties: {
      patientSummary: { type: Type.STRING },
      medicines: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            dosage: { type: Type.STRING },
            schedule: { type: Type.STRING },
            duration: { type: Type.STRING },
            instructions: { type: Type.STRING }
          },
          required: ["name"]
        }
      },
      doctorAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
      recognizedConditions: { type: Type.ARRAY, items: { type: Type.STRING } },
      lifestyleRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
      uncertaintyNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
      disclaimer: { type: Type.STRING }
    },
    required: [
      "patientSummary",
      "medicines",
      "doctorAdvice",
      "recognizedConditions",
      "lifestyleRecommendations",
      "warnings",
      "uncertaintyNotes",
      "disclaimer"
    ]
  };
}

function buildPrompt(input: AnalyzePrescriptionInput) {
  const prescriptionContext = input.extractedText
    ? `Prescription extracted text:\n${input.extractedText}`
    : "Prescription file is attached. Read it carefully before producing the structured summary.";

  return [
    "You are helping summarize a medical prescription for a patient-facing health companion demo.",
    "Use both the prescription and the user's symptom notes. The user's symptom notes are important clinical context and should influence recognizedConditions, lifestyleRecommendations, warnings, and uncertaintyNotes.",
    "Extract medicines and doctor-written advice from the prescription. For general conditions, warnings, and lifestyle suggestions, you may use careful medical reasoning from the prescription plus user symptoms, but do not present guesses as certain facts.",
    "If a condition is directly stated in the prescription, include it plainly. If a condition is reasonably inferred from symptoms or medicines, include it with wording like '(inferred from symptoms)' or '(possible, based on medicines/symptoms)'.",
    "The prescription text may contain OCR or PDF-parser noise: random letter sequences, broken words, repeated headers/footers, page numbers, emails, appointment IDs, registration numbers, disclaimers, and contact details.",
    "Ignore text that is clearly administrative metadata or nonsensical parser noise. Do not copy random gibberish into medicines, diagnoses, advice, warnings, or recognized conditions.",
    "If a medically meaningful phrase appears beside noise, keep the meaningful phrase and discard the noise. For example, from 'HIGH FEVER NJKNDJNJKJNNNN', keep 'High fever' and ignore 'NJKNDJNJKJNNNN'.",
    "Only include recognized conditions when they are human-readable and medically plausible from the prescription or symptoms. If a token might be noise, mention uncertainty instead of treating it as a condition.",
    "For medicines: put composition/ingredients in parentheses beside the medicine name, for example 'Oncet-CF (Cetirizine 5mg + Paracetamol 500mg + Phenylephrine 10mg)'. Do not put composition in dosage, schedule, duration, or instructions.",
    "If dosage, schedule, duration, or instructions are not clearly present, omit that field or leave it unspecified. Do not invent dosage, timing, or duration from the medicine composition.",
    "Warnings may include reasonable safety cautions derived from symptoms and medicine ingredients, such as checking allergies, avoiding duplicate paracetamol/acetaminophen use, or consulting a doctor if fever persists. Keep warnings conservative and patient-safe.",
    "Do not diagnose. If something is unclear, say so in uncertaintyNotes.",
    "Always include a clear disclaimer that this is not medical advice and the user should consult a licensed clinician.",
    "",
    prescriptionContext,
    "",
    `User symptom notes:\n${input.symptoms}`
  ].join("\n");
}

function parseJsonResponse(raw: string) {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  return JSON.parse(trimmed);
}

function mockAnalysis(input: AnalyzePrescriptionInput): AiAnalysis {
  return {
    patientSummary:
      "Demo summary generated in mock mode. The prescription and symptom notes were saved successfully.",
    medicines: [
      {
        name: "Sample medicine",
        dosage: "As written on prescription",
        schedule: "Follow the doctor's schedule",
        duration: "As prescribed",
        instructions: "Verify exact medicine details with the original prescription"
      }
    ],
    doctorAdvice: ["Review the original prescription and follow up with the prescribing doctor."],
    recognizedConditions: input.symptoms ? ["Based on notes: needs clinician review"] : [],
    lifestyleRecommendations: [
      "Stay hydrated, rest appropriately, and follow any lifestyle guidance written by the doctor."
    ],
    warnings: ["This mock output is for local app testing only."],
    uncertaintyNotes: [
      input.extractedText
        ? "PDF text extraction was available, but this is still mock analysis."
        : `${input.files?.length ?? 1} original file page(s) would be sent to Gemini when mock mode is disabled.`
    ],
    disclaimer:
      "This is not medical advice. Consult a licensed healthcare professional before taking or changing any medicine."
  };
}

export async function analyzePrescription(input: AnalyzePrescriptionInput): Promise<AnalyzePrescriptionResult> {
  if (env.AI_MOCK_MODE) {
    return { analysis: mockAnalysis(input) };
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when AI_MOCK_MODE is false");
  }

  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const responseSchema = buildResponseSchema(Type as unknown as Record<string, string>);
  const parts: any[] = [{ text: buildPrompt(input) }];

  if (!input.extractedText) {
    if (!input.files || input.files.length === 0) {
      throw new Error("File bytes are required when extracted text is not available");
    }

    input.files.forEach((file, index) => {
      parts.push({
        text: `Prescription page/file ${index + 1}${file.originalName ? `: ${file.originalName}` : ""}`
      });
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.buffer.toString("base64")
        }
      });
    });
  }

  const startedAt = performance.now();
  const response = await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as any
    }
  });
  const durationMs = performance.now() - startedAt;

  const rawText = response.text ?? "";
  const parsed = parseJsonResponse(rawText);
  const analysis = aiAnalysisSchema.parse(parsed);

  return {
    analysis,
    metadata: buildGeminiMetadata({
      model: env.GEMINI_MODEL,
      durationMs,
      usageMetadata: response.usageMetadata as Record<string, unknown> | undefined
    })
  };
}