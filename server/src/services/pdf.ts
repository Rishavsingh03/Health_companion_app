import pdfParse from "pdf-parse";

export function normalizeExtractedText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function isUsableExtractedText(text: string) {
  const normalized = normalizeExtractedText(text);
  const wordCount = normalized.length === 0 ? 0 : normalized.split(/\s+/).length;

  return normalized.length >= 80 && wordCount >= 8;
}

export async function extractPdfText(buffer: Buffer) {
  const parsed = await pdfParse(buffer);
  return normalizeExtractedText(parsed.text ?? "");
}

