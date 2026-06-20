import fs from "node:fs/promises";
import path from "node:path";
import { Router, type Request } from "express";
import mongoose from "mongoose";
import { env } from "../config";
import { ApiError } from "../errors";
import { requireAuth } from "../middleware/auth";
import { uploadPrescriptions } from "../middleware/upload";
import { Submission } from "../models/Submission";
import { createSubmissionSchema } from "../schemas";
import { serializeSubmission } from "../serializers/submission";
import { analyzePrescription } from "../services/gemini";
import { extractPdfText, isUsableExtractedText } from "../services/pdf";
import { asyncHandler } from "../utils/asyncHandler";

export const submissionsRouter = Router();

submissionsRouter.use(requireAuth);

function getUploadedFiles(req: Request) {
  const files = req.files;

  if (!files) {
    return [];
  }

  if (Array.isArray(files)) {
    return files;
  }

  return [...(files.prescription ?? []), ...(files.prescriptions ?? [])];
}

async function deleteUploadedFiles(files: Express.Multer.File[]) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
}

function validatePrescriptionFiles(files: Express.Multer.File[]) {
  if (files.length === 0) {
    throw new ApiError(400, "Prescription file is required");
  }

  const pdfFiles = files.filter((file) => file.mimetype === "application/pdf");
  const imageFiles = files.filter((file) => file.mimetype === "image/jpeg" || file.mimetype === "image/png"|| file.mimetype === "image/jpdcg");

  if (pdfFiles.length > 0 && files.length > 1) {
    throw new ApiError(400, "Upload either one PDF or up to 5 image pages, not both");
  }

  if (pdfFiles.length === 0 && imageFiles.length !== files.length) {
    throw new ApiError(400, "Only JPG, PNG, and PDF prescriptions are supported");
  }

  if (imageFiles.length > 5) {
    throw new ApiError(400, "Upload a maximum of 5 prescription image pages");
  }
}

submissionsRouter.post(
  "/",
  uploadPrescriptions.fields([
    { name: "prescription", maxCount: 1 },
    { name: "prescriptions", maxCount: 5 }
  ]),
  asyncHandler(async (req, res) => {
    const uploadedFiles = getUploadedFiles(req);

    const parsedInput = createSubmissionSchema.safeParse({
      symptoms : req.body.symptoms || "No concern"
    });
    
    if (!parsedInput.success) {
      await deleteUploadedFiles(uploadedFiles);
      throw parsedInput.error;
    }
    //console.log("fdsfs");
    const input = parsedInput.data;

    try {
      validatePrescriptionFiles(uploadedFiles);
    } catch (error) {
      await deleteUploadedFiles(uploadedFiles);
      throw error;
    }

    const primaryFile = uploadedFiles[0];
    const fileMetadata = uploadedFiles.map((file) => ({
      originalName: file.originalname,
      storedName: file.filename,
      path: file.path,
      mimeType: file.mimetype,
      size: file.size
    }));

    const submission = await Submission.create({
      userId: req.user!.id,
      symptoms: input.symptoms,
      file: fileMetadata[0],
      files: fileMetadata,
      status: "processing"
    });

    try {
      const primaryFileBuffer = await fs.readFile(primaryFile.path);
      let extractionMode: "pdf_text" | "gemini_file" = "gemini_file";
      let extractedText: string | undefined;

      if (primaryFile.mimetype === "application/pdf") {
        let candidateText = "";

        try {
          candidateText = await extractPdfText(primaryFileBuffer);
        } catch {
          candidateText = "";
        }

        if (isUsableExtractedText(candidateText)) {
          extractionMode = "pdf_text";
          extractedText = candidateText;
        }
      }
      const aiAnalysis = await analyzePrescription({
        symptoms: input.symptoms,
        extractedText,
        files: extractedText
          ? undefined
          : await Promise.all(
              uploadedFiles.map(async (file) => ({
                buffer: await fs.readFile(file.path),
                mimeType: file.mimetype,
                originalName: file.originalname
              }))
            )
      });

      submission.status = "completed";
      submission.extractionMode = extractionMode;
      submission.extractedText = extractedText;
      submission.aiAnalysis = aiAnalysis;
      submission.errorMessage = undefined;
      await submission.save();

      res.status(201).json({ submission: serializeSubmission(submission, true) });
    } catch (error) {
      submission.status = "failed";
      submission.errorMessage = error instanceof Error ? error.message : "Analysis failed";
      await submission.save();

      throw new ApiError(502, "Prescription analysis failed", {
        submissionId: submission._id.toString()
      });
    }
  })
);

submissionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const submissions = await Submission.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ submissions: submissions.map((submission) => serializeSubmission(submission)) });
  })
);

submissionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(404, "Submission not found");
    }

    const submission = await Submission.findOne({
      _id: req.params.id,
      userId: req.user!.id
    });

    if (!submission) {
      throw new ApiError(404, "Submission not found");
    }

    res.json({ submission: serializeSubmission(submission, true) });
  })
);

submissionsRouter.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(404, "Submission not found");
    }

    const submission = await Submission.findOne({
      _id: req.params.id,
      userId: req.user!.id
    });

    if (!submission) {
      throw new ApiError(404, "Submission not found");
    }

    const absolutePath = path.resolve(submission.file.path);
    const uploadRoot = path.resolve(env.UPLOAD_DIR);
    const relativePath = path.relative(uploadRoot, absolutePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new ApiError(404, "File not found");
    }

    const safeName = path.basename(submission.file.originalName).replace(/"/g, "");

    res.setHeader("Content-Type", submission.file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.sendFile(absolutePath);
  })
);

submissionsRouter.get(
  "/:id/files/:fileIndex",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(404, "Submission not found");
    }

    const submission = await Submission.findOne({
      _id: req.params.id,
      userId: req.user!.id
    });

    if (!submission) {
      throw new ApiError(404, "Submission not found");
    }

    const files = Array.isArray(submission.files) && submission.files.length > 0
      ? submission.files
      : [submission.file];
    const index = Number(req.params.fileIndex);
    const file = Number.isInteger(index) ? files[index] : undefined;

    if (!file) {
      throw new ApiError(404, "File not found");
    }

    const absolutePath = path.resolve(file.path);
    const uploadRoot = path.resolve(env.UPLOAD_DIR);
    const relativePath = path.relative(uploadRoot, absolutePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new ApiError(404, "File not found");
    }

    const safeName = path.basename(file.originalName).replace(/"/g, "");

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.sendFile(absolutePath);
  })
);
