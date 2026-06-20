import mongoose, { Schema, type InferSchemaType } from "mongoose";

const tokenUsageSchema = new Schema(
  {
    promptTokenCount: { type: Number },
    candidatesTokenCount: { type: Number },
    totalTokenCount: { type: Number },
    cachedContentTokenCount: { type: Number },
    thoughtsTokenCount: { type: Number },
    toolUsePromptTokenCount: { type: Number }
  },
  { _id: false }
);

const metadataSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ["gemini"],
      required: true
    },
    model: {
      type: String,
      required: true
    },
    operation: {
      type: String,
      enum: ["prescription_analysis"],
      required: true
    },
    durationMs: {
      type: Number,
      required: true,
      min: 0
    },
    tokenUsage: {
      type: tokenUsageSchema,
      default: undefined
    },
    rawUsageMetadata: { type: Schema.Types.Mixed }
  },
  {
    collection: "metadata",
    timestamps: true
  }
);

metadataSchema.index({ userId: 1, createdAt: -1 });
metadataSchema.index({ provider: 1, operation: 1, createdAt: -1 });

export type MetadataDocument = InferSchemaType<typeof metadataSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Metadata = mongoose.model("Metadata", metadataSchema);