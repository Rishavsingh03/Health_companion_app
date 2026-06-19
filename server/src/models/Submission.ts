import mongoose, { Schema, type InferSchemaType } from "mongoose";

const fileSchema = new Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const submissionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    symptoms: { type: String, required: true },
    file: { type: fileSchema, required: true },
    files: { type: [fileSchema], default: undefined },
    extractionMode: {
      type: String,
      enum: ["pdf_text", "gemini_file"],
      default: "gemini_file"
    },
    extractedText: { type: String },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true
    },
    aiAnalysis: { type: Schema.Types.Mixed },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

submissionSchema.index({ userId: 1, createdAt: -1 });

export type SubmissionDocument = InferSchemaType<typeof submissionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Submission = mongoose.model("Submission", submissionSchema);
