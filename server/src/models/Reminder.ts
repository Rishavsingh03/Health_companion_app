import mongoose, { Schema, type InferSchemaType } from "mongoose";

const reminderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    medicineName: {
      type: String,
      required: true,
      trim: true
    },
    dosage: {
      type: String,
      required: true,
      trim: true
    },
    frequency: {
      type: String,
      required: true,
      trim: true
    },
    reminderTime: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    agendaJobId: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reminderSchema.index({ userId: 1, medicineName: 1, isActive: 1 });

export type ReminderDocument = InferSchemaType<typeof reminderSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Reminder = mongoose.model("Reminder", reminderSchema);