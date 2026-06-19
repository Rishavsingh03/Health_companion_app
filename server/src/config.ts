import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  MONGODB_URI: process.env.MONGODB_URI ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  COOKIE_NAME: process.env.COOKIE_NAME ?? "hms_token",
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
  UPLOAD_DIR: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads"),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  AI_MOCK_MODE: process.env.AI_MOCK_MODE === "true"
};

export function validateEnv() {
  const missing: string[] = [];

  if (!env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!env.AI_MOCK_MODE && !env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
