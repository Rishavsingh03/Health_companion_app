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
      clinicalMetadata: {
        type: Type.OBJECT,
        properties: {
          deducedSpecialty: { type: Type.STRING }
        }
      },
      patientSummary: { type: Type.STRING },
      medicines: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            originalRawText: { type: Type.STRING },
            correctedName: { type: Type.STRING },
            dosage: { type: Type.STRING },
            schedule: { type: Type.STRING },
            duration: { type: Type.STRING },
            instructions: { type: Type.STRING }
          },
          required: ["name","originalRawText","correctedName"]
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
    "You are an expert Medical Informatics AI specializing in handwritten prescription interpretation, clinical entity resolution, and safety verification.",
    "",
    "Your core objective is to analyze noisy or mistranscribed prescription text alongside patient symptom notes to output an accurate, structured clinical summary.",
    "Use private reasoning to correct likely transcription errors before finalizing medicine names, but do not include your reasoning process or chain-of-thought in the final JSON.",
    "",
    "### CRITICAL RULES",
    "1. Do not simply accept the literal string from the prescription if it looks like a non-existent or misspelled drug.",
    "2. Use context clues such as doctor's specialty header, clinic metadata, patient symptoms, diagnosed diseases, and prescribed medicine class to deduce the correct medical domain.",
    "3. Cross-reference misspelled drugs against your medical knowledge of pharmaceutical nomenclature within that domain.",
    "4. Do not invent dosage, schedule, duration, or timing when they are not clearly present. Leave those fields absent/unspecified instead.",
    "5. Composition/ingredients belong in parentheses beside the medicine name, not inside dosage, schedule, duration, or instructions.",
    "6. The user's symptom notes are important clinical context and must influence recognizedConditions, warnings, lifestyleRecommendations, and uncertaintyNotes.",
    "",
    "### STRUCTURED REASONING PROTOCOL",
    "Perform these steps privately before generating the output:",
    "STEP 1: Contextual Domain Mapping - analyze prescription headers, clinic metadata, doctor specialty, diagnosis, medicines, and patient symptom notes. Identify the likely medical specialty and put it in clinicalMetadata.deducedSpecialty.",
    "STEP 2: Raw Extraction & Anomaly Detection - extract raw medicine names exactly as they appear. Flag ambiguous, non-existent, noisy, or likely mistranscribed drug names.",
    "STEP 3: Clinical Entity Resolution - for each flagged anomaly, use the targeted condition, domain, symptoms, and medicine-class context to choose the most likely corrected medicine name. Consider phonetic and visual similarity, such as 'Oxefol' likely being 'Oxetol' in a neurology/seizure context.",
    "STEP 4: Output Formulation - use corrected clinical entities in the final payload and include the required medical disclaimer.",
    "",
    "### NOISE HANDLING",
    "The prescription text may contain OCR or PDF-parser noise: random letter sequences, broken words, repeated headers/footers, page numbers, emails, appointment IDs, registration numbers, disclaimers, and contact details.",
    "Ignore text that is clearly administrative metadata or nonsensical parser noise. Do not copy random gibberish into medicines, diagnoses, advice, warnings, or recognized conditions.",
    "If a medically meaningful phrase appears beside noise, keep the meaningful phrase and discard the noise. Example: from 'HIGH FEVER NJKNDJNJKJNNNN', keep 'High fever' and ignore 'NJKNDJNJKJNNNN'.",
    "",
    "### MEDICINE OUTPUT RULES",
    "For each medicine, originalRawText is mandatory. Set originalRawText to the exact raw medicine text as extracted/seen before correction. If the text is already clean, originalRawText should still contain that same raw medicine name.",
    "correctedName is mandatory. Set correctedName to the validated/corrected pharmaceutical name. If no correction is needed, correctedName should equal the clean medicine name.",
    "Set name to the final display name. If composition is present, include it in parentheses beside the medicine name, for example 'Oncet-CF (Cetirizine 5mg + Paracetamol 500mg + Phenylephrine 10mg)'.",
    "If no correction is needed, name and correctedName may be the same.",
    "Do not put composition in dosage, schedule, duration, or instructions.",
    "If dosage, schedule, duration, or instructions are not clearly present, omit that field or leave it unspecified.",
    "",
    "### CLINICAL SUMMARY RULES",
    "recognizedConditions should include conditions directly present in the prescription and reasonable possibilities inferred from symptoms or medicines. Label inferred items, for example '(inferred from symptoms)' or '(possible, based on medicines/symptoms)'.",
    "warnings may include conservative safety cautions derived from symptoms and medicine ingredients, such as checking allergies, avoiding duplicate paracetamol/acetaminophen use, avoiding alcohol/sedation-risk activities for sedating antihistamines, or consulting a doctor if fever persists.",
    "lifestyleRecommendations should combine doctor's advice from the prescription and safe general measures relevant to the user's symptoms.",
    "Do not diagnose with certainty. If something is unclear, say so in uncertaintyNotes.",
    "Always include this disclaimer exactly in disclaimer: 'CRITICAL: This is an AI-generated summary for informational purposes only and is not medical advice. Please verify these medications with a licensed professional.'",
    "",
    "### OUTPUT FORMAT",
    "Return strictly valid JSON matching the provided response schema. Do not include markdown. Do not include your thinking process inside the JSON.",
    "",
    "### INPUT DATA",
    prescriptionContext,
    "",
    `Patient symptom notes:\n${input.symptoms}`
  ].join("\n");
}

function parseJsonResponse(raw: string) {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  return JSON.parse(trimmed);
}

function mockAnalysis(input: AnalyzePrescriptionInput): AiAnalysis {
  return {
    clinicalMetadata: {
      deducedSpecialty: "General Medicine"
    },
    patientSummary:
      "Demo summary generated in mock mode. The prescription and symptom notes were saved successfully.",
    medicines: [
      {
        name: "Sample medicine",
        originalRawText: "Sample medicine",
        correctedName: "Sample medicine",
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
      "CRITICAL: This is an AI-generated summary for informational purposes only and is not medical advice. Please verify these medications with a licensed professional."
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
  console.log("analyze before ");
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
  console.log("Analyze after");
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