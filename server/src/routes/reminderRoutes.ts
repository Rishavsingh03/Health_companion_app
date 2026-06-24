import { Router } from "express";
import {
  createReminder,
  deleteReminder,
  getReminders,
  patchReminder
} from "../controllers/reminderController";
import { requireAuth } from "../middleware/auth";

export const reminderRouter = Router();

reminderRouter.use(requireAuth);

reminderRouter.post("/", createReminder);
reminderRouter.get("/:userId", getReminders);
reminderRouter.patch("/:id", patchReminder);
reminderRouter.delete("/:id", deleteReminder);

