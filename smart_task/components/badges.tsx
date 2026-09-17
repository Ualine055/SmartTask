import { cx } from "./ui";
import type { DisplayStatus } from "@/lib/tasks";
import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS } from "@/lib/types";
import type { Priority, Role } from "@/lib/types";

const BASE =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

const STATUS_TONES: Record<DisplayStatus, string> = {
  incoming: "bg-slate-100 text-slate-700 ring-slate-200",
  ongoing: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cannot_complete: "bg-amber-50 text-amber-800 ring-amber-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
};

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  ...STATUS_LABELS,
  overdue: "Overdue",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={cx(BASE, STATUS_TONES[status])}>
      {DISPLAY_STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_TONES: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  high: "bg-red-50 text-red-700 ring-red-200",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cx(BASE, PRIORITY_TONES[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const ROLE_TONES: Record<Role, string> = {
  admin: "bg-purple-50 text-purple-700 ring-purple-200",
  hod: "bg-brand-50 text-brand-700 ring-brand-200",
  lecturer: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function RoleBadge({ role }: { role: Role }) {
  return <span className={cx(BASE, ROLE_TONES[role])}>{ROLE_LABELS[role]}</span>;
}
