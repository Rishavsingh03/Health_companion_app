export type User = {
  id: string;
  email: string;
};

export type AiMedicine = {
  name: string;
  originalRawText: string;
  correctedName: string;
  dosage?: string;
  schedule?: string;
  duration?: string;
  instructions?: string;
};

export type AiAnalysis = {
  clinicalMetadata?: {
    deducedSpecialty?: string;
  };
  patientSummary: string;
  medicines: AiMedicine[];
  doctorAdvice: string[];
  recognizedConditions: string[];
  lifestyleRecommendations: string[];
  warnings: string[];
  uncertaintyNotes: string[];
  disclaimer: string;
};

export type SubmissionListItem = {
  id: string;
  symptoms: string;
  status: "processing" | "completed" | "failed";
  extractionMode: "pdf_text" | "gemini_file";
  file: {
    originalName: string;
    mimeType: string;
    size: number;
  };
  files?: Array<{
    index: number;
    originalName: string;
    mimeType: string;
    size: number;
  }>;
  summary: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionDetail = SubmissionListItem & {
  extractedText?: string;
  aiAnalysis?: AiAnalysis;
};