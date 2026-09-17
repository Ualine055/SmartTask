"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "./auth-provider";
import { cx } from "./ui";
import { useVisibleTasks } from "@/lib/hooks/use-tasks";
import { byDeadline, formatDateTime, isDueSoon, isOverdue } from "@/lib/tasks";
import type { Task } from "@/lib/types";

/**
 * In-app notifications: a live count of the signed-in user's tasks that are
 * overdue or fall due within 24 hours. Both conditions are derived from the
 * deadline on each render, so the badge is correct without any stored state.
 */
export function NotificationBell() {
  const { profile } = useAuth();
  const { tasks } = useVisibleTasks();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { overdue, dueSoon } = useMemo(() => {
    const now = new Date();
    return {
      overdue: tasks.filter((t) => isOverdue(t, now)).sort(byDeadline),
      dueSoon: tasks.filter((t) => isDueSoon(t, now)).sort(byDeadline),
    };
  }, [tasks]);

  const count = overdue.length + dueSoon.length;

  // Close when clicking away or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const taskHref = (task: Task) =>
    profile?.role === "lecturer" ? `/my-tasks/${task.id}` : `/tasks/${task.id}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          count > 0 ? `Notifications, ${count} needing attention` : "Notifications"
        }
        className="relative rounded-lg p-2 text-muted transition-colors hover:bg-slate-100 hover:text-ink"
      >
        <BellIcon />
        {count > 0 ? (
          <span
            className={cx(
              "absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 py-0.5",
              "text-[10px] font-semibold leading-none text-white",
              overdue.length > 0 ? "bg-red-600" : "bg-amber-500",
            )}
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={cx(
            "absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)]",
            "overflow-hidden rounded-xl border border-line bg-white shadow-lg",
          )}
        >
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            Needs attention
          </p>

          {count === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Nothing due in the next 24 hours.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {overdue.map((task) => (
                <NotificationRow
                  key={task.id}
                  task={task}
                  href={taskHref(task)}
                  tone="overdue"
                  onNavigate={() => setOpen(false)}
                />
              ))}
              {dueSoon.map((task) => (
                <NotificationRow
                  key={task.id}
                  task={task}
                  href={taskHref(task)}
                  tone="dueSoon"
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  task,
  href,
  tone,
  onNavigate,
}: {
  task: Task;
  href: string;
  tone: "overdue" | "dueSoon";
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="block px-4 py-3 transition-colors hover:bg-slate-50"
      >
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className={cx(
              "mt-1.5 size-2 shrink-0 rounded-full",
              tone === "overdue" ? "bg-red-600" : "bg-amber-500",
            )}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{task.title}</p>
            <p className="text-xs text-muted">
              {tone === "overdue" ? "Overdue since " : "Due "}
              {formatDateTime(task.deadline)}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
