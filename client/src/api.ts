import type { Reminder, SubmissionDetail, SubmissionListItem, User } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type ApiErrorPayload = {
  error?: {
    message?: string;
  } | string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const payload = (await response.json()) as ApiErrorPayload;
      message = typeof payload.error === "string" ? payload.error : payload.error?.message ?? message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function signup(email: string, password: string) {
  return request<{ user: User }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function login(email: string, password: string) {
  return request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function logout() {
  return request<void>("/auth/logout", {
    method: "POST"
  });
}

export function getMe() {
  return request<{ user: User }>("/auth/me");
}

export function listSubmissions() {
  return request<{ submissions: SubmissionListItem[] }>("/submissions");
}

export function getSubmission(id: string) {
  return request<{ submission: SubmissionDetail }>(`/submissions/${id}`);
}

export function createSubmission(formData: FormData) {
  return request<{ submission: SubmissionDetail }>("/submissions", {
    method: "POST",
    body: formData
  });
}

export function fileUrl(submissionId: string, fileIndex?: number) {
  if (typeof fileIndex === "number") {
    return `${API_BASE_URL}/submissions/${submissionId}/files/${fileIndex}`;
  }

  return `${API_BASE_URL}/submissions/${submissionId}/file`;
}

export function listReminders(userId: string) {
  return request<{ success: boolean; data: Reminder[] }>(`/reminders/${userId}`);
}

export function createReminder(input: {
  medicineName: string;
  dosage: string;
  frequency: string;
  reminderTime: string;
}) {
  return request<{ success: boolean; data: Reminder }>("/reminders", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateReminder(
  id: string,
  input: {
    reminderTime: string;
  }
) {
  return request<{ success: boolean; data: Reminder }>(`/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteReminder(id: string) {
  return request<{ success: boolean; data: Reminder }>(`/reminders/${id}`, {
    method: "DELETE"
  });
}