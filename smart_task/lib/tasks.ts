import type { Timestamp } from "firebase/firestore";
import type { Priority, Status, Task } from "./types";

/** Anything with a `toDate()` - works for both client and admin Timestamps. */
type TimestampLike = { toDate: () => Date } | Timestamp | null | undefined;

export function toDate(value: TimestampLike): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/** A task is "open" while the lecturer still owes work on it. */
export function isOpen(status: Status): boolean {
  return status === "incoming" || status === "ongoing";
}

/**
 * Derived, never stored: a task is overdue when its deadline has passed and
 * the lecturer has neither completed nor declined it.
 */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  const deadline = toDate(task.deadline);
  return Boolean(deadline && isOpen(task.status) && deadline.getTime() < now.getTime());
}

export const DUE_SOON_MS = 24 * 60 * 60 * 1000;

/** Open, not yet overdue, but the deadline lands within the next 24 hours. */
export function isDueSoon(task: Task, now: Date = new Date()): boolean {
  const deadline = toDate(task.deadline);
  if (!deadline || !isOpen(task.status)) return false;
  const diff = deadline.getTime() - now.getTime();
  return diff >= 0 && diff <= DUE_SOON_MS;
}

/** The status shown in the UI - the stored status, widened with "overdue". */
export type DisplayStatus = Status | "overdue";

export function displayStatus(task: Task, now: Date = new Date()): DisplayStatus {
  return isOverdue(task, now) ? "overdue" : task.status;
}

export interface TaskCounts {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueSoon: number;
  declined: number;
}

export function countTasks(tasks: Task[], now: Date = new Date()): TaskCounts {
  const counts: TaskCounts = {
    total: tasks.length,
    completed: 0,
    pending: 0,
    overdue: 0,
    dueSoon: 0,
    declined: 0,
  };
  for (const task of tasks) {
    if (task.status === "completed") counts.completed += 1;
    else if (task.status === "cannot_complete") counts.declined += 1;
    else {
      // incoming or ongoing
      counts.pending += 1;
      if (isOverdue(task, now)) counts.overdue += 1;
      else if (isDueSoon(task, now)) counts.dueSoon += 1;
    }
  }
  return counts;
}

/** Soonest deadline first; tasks without a deadline sink to the bottom. */
export function byDeadline(a: Task, b: Task): number {
  const da = toDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const dbb = toDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return da - dbb;
}

export function byNewest(a: Task, b: Task): number {
  const da = toDate(a.createdAt)?.getTime() ?? 0;
  const dbb = toDate(b.createdAt)?.getTime() ?? 0;
  return dbb - da;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function formatDateTime(value: TimestampLike | Date | null): string {
  const date = value instanceof Date ? value : toDate(value as TimestampLike);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", DATE_FORMAT).format(date);
}

/** "in 3 days" / "2 hours ago" - relative to the deadline. */
export function relativeToNow(value: TimestampLike | Date | null, now: Date = new Date()): string {
  const date = value instanceof Date ? value : toDate(value as TimestampLike);
  if (!date) return "";
  const diffMs = date.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === "minute") {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return "";
}

/** For <input type="datetime-local"> which wants `YYYY-MM-DDTHH:mm` in local time. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
