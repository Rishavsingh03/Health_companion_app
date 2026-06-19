import type { SubmissionDocument } from "../models/Submission";

export function serializeSubmission(submission: SubmissionDocument, includeAnalysis = false) {
  const medicines = Array.isArray(submission.aiAnalysis?.medicines)
    ? submission.aiAnalysis.medicines.length
    : 0;
  const files = Array.isArray(submission.files) && submission.files.length > 0
    ? submission.files
    : [submission.file];

  return {
    id: submission._id.toString(),
    symptoms: submission.symptoms,
    status: submission.status,
    extractionMode: submission.extractionMode,
    file: {
      originalName: files[0].originalName,
      mimeType: files[0].mimeType,
      size: files[0].size
    },
    files: files.map((file, index) => ({
      index,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size
    })),
    summary:
      submission.status === "completed"
        ? `${medicines} medicine${medicines === 1 ? "" : "s"} detected`
        : submission.status,
    errorMessage: submission.errorMessage,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    ...(includeAnalysis
      ? {
          extractedText: submission.extractedText,
          aiAnalysis: submission.aiAnalysis
        }
      : {})
  };
}
