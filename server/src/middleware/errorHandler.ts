import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../errors";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        details: err.details
      }
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        details: err.flatten()
      }
    });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File must be 5 MB or smaller" : err.message;
    return res.status(400).json({
      error: {
        message
      }
    });
  }

  console.error(err);

  return res.status(500).json({
    error: {
      message: "Something went wrong"
    }
  });
};

