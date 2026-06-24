import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters").max(128)
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export const loginSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128)
});

export const verifyOtpSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit code")
});

export const resendOtpSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase())
});

export const createSubmissionSchema = z.object({
  symptoms: z
    .string()
    .trim()
    .min(3, "Please describe symptoms or health concerns")
    .max(2000, "Symptom notes must be under 2000 characters")
});

export const aiAnalysisSchema = z.object({
  clinicalMetadata: z
    .object({
      deducedSpecialty: z.string().optional()
    })
    .optional(),
  patientSummary: z.string().min(1),
  medicines: z.array(
    z.object({
      name: z.string().min(1),
      originalRawText: z.string().min(1),
      correctedName: z.string().min(1),
      dosage: z.string().optional(),
      schedule: z.string().optional(),
      duration: z.string().optional(),
      instructions: z.string().optional()
    })
  ),
  doctorAdvice: z.array(z.string()),
  recognizedConditions: z.array(z.string()),
  lifestyleRecommendations: z.array(z.string()),
  warnings: z.array(z.string()),
  uncertaintyNotes: z.array(z.string()),
  disclaimer: z.string().min(1)
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;