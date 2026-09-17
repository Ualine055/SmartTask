import type { Timestamp } from "firebase/firestore";

export const ROLES = ["admin", "hod", "lecturer"] as const;
export type Role = (typeof ROLES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Stored statuses only. "overdue" is intentionally NOT one of them - it is
 * derived from `deadline < now`, so no nightly job is needed to flip tasks.
 * See taskView() in lib/tasks.ts.
 */
export const STATUSES = [
  "incoming",
  "ongoing",
  "completed",
  "cannot_complete",
] as const;
export type Status = (typeof STATUSES)[number];

export interface AppUser {
  uid: string;
  fullName: string;
  email: string;
  role: Role;
  department: string;
  isActive: boolean;
  createdAt: Timestamp | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy: string;
  assignedByName: string;
  priority: Priority;
  deadline: Timestamp;
  status: Status;
  progressNote: string;
  declineReason: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  completedAt: Timestamp | null;
  lastReminderSentAt: Timestamp | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  hod: "Head of Department",
  lecturer: "Lecturer",
};

export const STATUS_LABELS: Record<Status, string> = {
  incoming: "Incoming",
  ongoing: "Ongoing",
  completed: "Completed",
  cannot_complete: "Cannot complete",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Landing page for each role once signed in. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: "/admin/users",
  hod: "/dashboard",
  lecturer: "/my-tasks",
};
