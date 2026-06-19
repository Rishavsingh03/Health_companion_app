import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { env } from "../config";
import { ApiError } from "../errors";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
const maxUploadBytes = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  }
});

export const uploadPrescriptions = multer({
  storage,
  limits: {
    fileSize: maxUploadBytes,
    files: 5
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new ApiError(400, "Only JPG, PNG, and PDF prescriptions are supported"));
      return;
    }

    cb(null, true);
  }
});

