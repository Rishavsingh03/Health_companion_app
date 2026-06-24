import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { ApiError } from "../errors";
import { Reminder, type ReminderDocument } from "../models/Reminder";

const REMINDER_JOB_NAME = "send medicine reminder email";
const REMINDER_TIMEZONE = "Asia/Kolkata";
const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type ScheduleReminderInput = {
  userId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  reminderTime: string;
  email: string;
};

type UpdateReminderInput = {
  userId: string;
  reminderId: string;
  reminderTime: string;
};

type CancelReminderInput = {
  userId: string;
  reminderId: string;
};

type ReminderJobData = {
  reminderId: string;
};

type ReminderAgendaJob = {
  attrs: {
    _id?: { toString(): string };
    data?: ReminderJobData;
  };
  repeatEvery: (
    interval: string,
    options: {
      timezone: string;
      skipImmediate: boolean;
    }
  ) => void;
  save: () => Promise<void>;
};

type AgendaInstance = {
  cancel: (options: { id?: string }) => Promise<number>;
  create: (name: string, data: ReminderJobData) => ReminderAgendaJob;
  define: (name: string, processor: (job: ReminderAgendaJob) => Promise<void>) => void;
  start: () => Promise<void>;
};

let agenda: AgendaInstance | null = null;

function getAgenda() {
  if (!agenda) {
    throw new Error("Reminder scheduler has not been started");
  }

  return agenda;
}

function assertReminderTime(reminderTime: string) {
  if (!REMINDER_TIME_PATTERN.test(reminderTime)) {
    throw new ApiError(400, "Reminder time must be in HH:MM format");
  }
}

function assertObjectId(id: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `${label} is invalid`);
  }
}

function reminderToResponse(reminder: ReminderDocument) {
  return {
    id: reminder._id.toString(),
    userId: reminder.userId.toString(),
    medicineName: reminder.medicineName,
    dosage: reminder.dosage,
    frequency: reminder.frequency,
    reminderTime: reminder.reminderTime,
    email: reminder.email,
    agendaJobId: reminder.agendaJobId,
    isActive: reminder.isActive,
    createdAt: reminder.createdAt
  };
}

function cronFromTime(reminderTime: string) {
  const [hour, minute] = reminderTime.split(":");
  return `${Number(minute)} ${Number(hour)} * * *`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReminderEmail(reminder: ReminderDocument) {
  const medicineName = escapeHtml(reminder.medicineName);
  const dosage = escapeHtml(reminder.dosage);
  const frequency = escapeHtml(reminder.frequency);

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Time to take your medicine</h2>
      <p style="margin: 0 0 16px;">This is your daily medicine reminder.</p>
      <table style="border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Medicine</td>
          <td style="padding: 6px 0;">${medicineName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Dosage</td>
          <td style="padding: 6px 0;">${dosage}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: bold;">Frequency</td>
          <td style="padding: 6px 0;">${frequency}</td>
        </tr>
      </table>
      <p style="margin-top: 18px; font-size: 13px; color: #475569;">
        This reminder is for informational support only. Follow your doctor's prescription.
      </p>
    </div>
  `;
}

function getMailTransport() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASSWORD are required for reminder emails");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass
    }
  });
}

async function sendReminderEmail(reminder: ReminderDocument) {
  const transporter = getMailTransport();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: reminder.email,
    subject: `Medicine reminder: ${reminder.medicineName}`,
    html: buildReminderEmail(reminder)
  });
}

async function cancelAgendaJob(agendaJobId: string) {
  await getAgenda().cancel({ id: agendaJobId });
}

async function createAgendaJob(reminderId: string, reminderTime: string) {
  const job = getAgenda().create(REMINDER_JOB_NAME, { reminderId } satisfies ReminderJobData);
  job.repeatEvery(cronFromTime(reminderTime), {
    timezone: REMINDER_TIMEZONE,
    skipImmediate: true
  });

  await job.save();

  return job.attrs._id?.toString();
}

export async function startScheduler() {
  try {
    if (agenda) {
      return;
    }

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB connection is not ready for Agenda");
    }

    const [{ Agenda }, { MongoBackend }] = await Promise.all([
      import("agenda"),
      import("@agendajs/mongo-backend")
    ]);

    agenda = new Agenda({
      backend: new MongoBackend({
        mongo: db as never,
        collection: "agendaJobs"
      })
    }) as unknown as AgendaInstance;

    agenda.define(REMINDER_JOB_NAME, async (job) => {
      const reminderId = job.attrs.data?.reminderId;

      if (!reminderId) {
        return;
      }

      const reminder = await Reminder.findOne({
        _id: reminderId,
        isActive: true
      });

      if (!reminder) {
        return;
      }

      await sendReminderEmail(reminder);
    });

    await agenda.start();
  } catch (error) {
    console.error("Failed to start reminder scheduler", error);
    throw error;
  }
}

export async function scheduleReminder(input: ScheduleReminderInput) {
  try {
    assertReminderTime(input.reminderTime);

    const existing = await Reminder.findOne({
      userId: input.userId,
      medicineName: input.medicineName,
      isActive: true
    });

    if (existing) {
      throw new ApiError(409, "An active reminder already exists for this medicine");
    }

    const reminder = await Reminder.create({
      userId: input.userId,
      medicineName: input.medicineName,
      dosage: input.dosage,
      frequency: input.frequency,
      reminderTime: input.reminderTime,
      email: input.email,
      agendaJobId: "pending",
      isActive: true
    });

    const agendaJobId = await createAgendaJob(reminder._id.toString(), input.reminderTime);

    if (!agendaJobId) {
      await Reminder.deleteOne({ _id: reminder._id });
      throw new Error("Unable to create Agenda job");
    }

    reminder.agendaJobId = agendaJobId;
    await reminder.save();

    return reminderToResponse(reminder);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("Failed to schedule reminder", error);
    throw new ApiError(500, "Unable to schedule reminder");
  }
}

export async function updateReminder(input: UpdateReminderInput) {
  try {
    assertReminderTime(input.reminderTime);
    assertObjectId(input.reminderId, "Reminder id");

    const reminder = await Reminder.findOne({
      _id: input.reminderId,
      userId: input.userId,
      isActive: true
    });

    if (!reminder) {
      throw new ApiError(404, "Reminder not found");
    }

    await cancelAgendaJob(reminder.agendaJobId);
    const agendaJobId = await createAgendaJob(reminder._id.toString(), input.reminderTime);

    if (!agendaJobId) {
      throw new Error("Unable to create Agenda job");
    }

    reminder.reminderTime = input.reminderTime;
    reminder.agendaJobId = agendaJobId;
    await reminder.save();

    return reminderToResponse(reminder);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("Failed to update reminder", error);
    throw new ApiError(500, "Unable to update reminder");
  }
}

export async function cancelReminder(input: CancelReminderInput) {
  try {
    assertObjectId(input.reminderId, "Reminder id");

    const reminder = await Reminder.findOne({
      _id: input.reminderId,
      userId: input.userId,
      isActive: true
    });

    if (!reminder) {
      throw new ApiError(404, "Reminder not found");
    }

    await cancelAgendaJob(reminder.agendaJobId);
    await Reminder.deleteOne({ _id: reminder._id });

    return reminderToResponse(reminder);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("Failed to cancel reminder", error);
    throw new ApiError(500, "Unable to cancel reminder");
  }
}

export async function listReminders(userId: string) {
  try {
    const reminders = await Reminder.find({
      userId,
      isActive: true
    }).sort({ createdAt: -1 });

    return reminders.map((reminder) => reminderToResponse(reminder));
  } catch (error) {
    console.error("Failed to list reminders", error);
    throw new ApiError(500, "Unable to load reminders");
  }
}