"use client";

import Link from "next/link";

import { PriorityBadge, StatusBadge } from "./badges";
import { cx } from "./ui";
import { displayStatus, formatDateTime, isOverdue, relativeToNow } from "@/lib/tasks";
import type { Task } from "@/lib/types";

/**
 * One task in a list. `showAssignee` is off for a lecturer's own list, where
 * every row would otherwise repeat their own name.
 */
export function TaskRow({
  task,
  href,
  showAssignee = true,
  now,
}: {
  task: Task;
  href: string;
  showAssignee?: boolean;
  now?: Date;
}) {
  const reference = now ?? new Date();
  const overdue = isOverdue(task, reference);

  return (
    <li>
      <Link
        href={href}
        className={cx(
          "block border-l-4 px-4 py-3 transition-colors hover:bg-slate-50",
          overdue ? "border-l-red-500" : "border-l-transparent",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{task.title}</p>

            <p className="mt-0.5 truncate text-xs text-muted">
              {showAssignee ? <>Assigned to {task.assignedToName} · </> : null}
              Due {formatDateTime(task.deadline)}
              <span className={cx("ml-1", overdue && "font-medium text-red-600")}>
                ({relativeToNow(task.deadline, reference)})
              </span>
            </p>

            {task.status === "cannot_complete" && task.declineReason ? (
              <p className="mt-1 line-clamp-2 text-xs text-amber-800">
                Declined: {task.declineReason}
              </p>
            ) : task.progressNote ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted">{task.progressNote}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={displayStatus(task, reference)} />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function TaskList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      {children}
    </ul>
  );
}
