import type { Request, Response } from "express";
import { ApiError } from "../errors";
import {
  cancelReminder,
  listReminders,
  scheduleReminder,
  updateReminder
} from "../services/reminderService";

type ReminderBody = {
  medicineName?: unknown;
  dosage?: unknown;
  frequency?: unknown;
  reminderTime?: unknown;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function statusCode(error: unknown) {
  return error instanceof ApiError ? error.statusCode : 500;
}

function readReminderBody(body: ReminderBody) {
  if (
    typeof body.medicineName !== "string" ||
    typeof body.dosage !== "string" ||
    typeof body.frequency !== "string" ||
    typeof body.reminderTime !== "string"
  ) {
    throw new ApiError(400, "medicineName, dosage, frequency, and reminderTime are required");
  }

  const input = {
    medicineName: body.medicineName.trim(),
    dosage: body.dosage.trim(),
    frequency: body.frequency.trim(),
    reminderTime: body.reminderTime.trim()
  };

  if (!input.medicineName || !input.dosage || !input.frequency || !input.reminderTime) {
    throw new ApiError(400, "medicineName, dosage, frequency, and reminderTime cannot be empty");
  }

  return input;
}

function currentUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  return req.user;
}

export async function createReminder(req: Request, res: Response) {
  try {
    const user = currentUser(req);
    const input = readReminderBody(req.body as ReminderBody);
    const reminder = await scheduleReminder({
      userId: user.id,
      email: user.email,
      ...input
    });

    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    res.status(statusCode(error)).json({ success: false, error: errorMessage(error) });
  }
}

export async function getReminders(req: Request, res: Response) {
  try {
    const user = currentUser(req);

    if (req.params.userId !== user.id) {
      throw new ApiError(403, "You can only view your own reminders");
    }

    const reminders = await listReminders(user.id);

    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(statusCode(error)).json({ success: false, error: errorMessage(error) });
  }
}

export async function patchReminder(req: Request, res: Response) {
  try {
    const user = currentUser(req);
    const reminderTime = (req.body as ReminderBody).reminderTime;

    if (typeof reminderTime !== "string") {
      throw new ApiError(400, "reminderTime is required");
    }

    const reminder = await updateReminder({
      userId: user.id,
      reminderId: req.params.id,
      reminderTime: reminderTime.trim()
    });

    res.json({ success: true, data: reminder });
  } catch (error) {
    res.status(statusCode(error)).json({ success: false, error: errorMessage(error) });
  }
}

export async function deleteReminder(req: Request, res: Response) {
  try {
    const user = currentUser(req);
    const reminder = await cancelReminder({
      userId: user.id,
      reminderId: req.params.id
    });

    res.json({ success: true, data: reminder });
  } catch (error) {
    res.status(statusCode(error)).json({ success: false, error: errorMessage(error) });
  }
}