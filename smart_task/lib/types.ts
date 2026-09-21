import type { Timestamp } from "firebase/firestore";

export const ROLES = ["admin", "hod", "lecturer"] as const;
export type Role = (typeof ROLES)[number];

/**
 * The three programmes in the Department of Computing and IT, which is the
 * department this system serves. Registration and the admin form both read
 * this list, so adding a fourth is a one-line change here.
 */
export const DEPARTMENTS = ["Computer Science", "BIT", "BBIT"] as const;

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

/**
 * Which roles each signed-in area is for. Keys are route prefixes, matched on
 * segment boundaries so "/tasks" does not also swallow "/my-tasks".
 *
 * The <Protected roles={...}> wrapper on each page is still what gates it.
 * This list exists so the sign-in redirect can check a target *before* sending
 * someone there.
 */
const AREA_ROLES: ReadonlyArray<{ prefix: string; roles: readonly Role[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/my-tasks", roles: ["lecturer"] },
  { prefix: "/tasks", roles: ["hod"] },
  { prefix: "/dashboard", roles: ROLES },
];

/** Could this role open this in-app path without being turned away? */
export function canRoleOpen(path: string, role: Role): boolean {
  const pathname = path.split(/[?#]/)[0];
  const area = AREA_ROLES.find(
    (a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`),
  );
  return area ? area.roles.includes(role) : false;
}

/**
 * Where to send someone once they are signed in.
 *
 * `next` comes from the query string, so it is checked twice before it is
 * trusted:
 *
 *   1. it must be a plain in-app path - never "//host" or "https://host",
 *      which would turn the login page into an open redirect;
 *   2. it must be a page this role can actually open - otherwise a lecturer
 *      who arrives at /login?next=/tasks (because that URL was opened while
 *      signed out) lands on "Not available for your role" instead of their
 *      own task list.
 *
 * Anything that fails either check falls back to the role's own home page.
 */
export function homeAfterSignIn(next: string | null | undefined, role: Role): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\") &&
    canRoleOpen(next, role)
  ) {
    return next;
  }
  return HOME_FOR_ROLE[role];
}
