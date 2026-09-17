"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useAuth } from "@/components/auth-provider";
import { Protected } from "@/components/protected";
import { TaskList, TaskRow } from "@/components/task-row";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  cx,
} from "@/components/ui";
import { useVisibleTasks } from "@/lib/hooks/use-tasks";
import { useUsers } from "@/lib/hooks/use-users";
import { byDeadline, countTasks, isDueSoon, isOverdue } from "@/lib/tasks";
import { HOME_FOR_ROLE, type Task } from "@/lib/types";

/**
 * /dashboard is the single post-login destination. Admins and lecturers are
 * forwarded to their own home screen; the HoD overview lives here.
 */
export default function DashboardPage() {
  return (
    <Protected>
      <DashboardRouter />
    </Protected>
  );
}

function DashboardRouter() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!profile || profile.role === "hod") return;
    router.replace(HOME_FOR_ROLE[profile.role]);
  }, [profile, router]);

  if (!profile) return <Spinner />;
  if (profile.role !== "hod") return <Spinner label="Taking you to your tasks" />;

  return <HodDashboard />;
}

function HodDashboard() {
  const { profile } = useAuth();
  const { tasks, loading, error } = useVisibleTasks();
  const { users } = useUsers();

  const now = useMemo(() => new Date(), []);
  const counts = useMemo(() => countTasks(tasks, now), [tasks, now]);

  /** Per-lecturer workload, busiest first. */
  const workload = useMemo(() => {
    const lecturers = users.filter((u) => u.role === "lecturer");
    const rows = lecturers.map((lecturer) => {
      const theirs = tasks.filter((t) => t.assignedTo === lecturer.uid);
      return { lecturer, ...countTasks(theirs, now) };
    });
    // Include anyone with tasks who is no longer listed as an active lecturer.
    const known = new Set(lecturers.map((l) => l.uid));
    for (const task of tasks) {
      if (known.has(task.assignedTo)) continue;
      known.add(task.assignedTo);
      const theirs = tasks.filter((t) => t.assignedTo === task.assignedTo);
      rows.push({
        lecturer: {
          uid: task.assignedTo,
          fullName: task.assignedToName,
          email: "",
          role: "lecturer",
          department: "",
          isActive: false,
          createdAt: null,
        },
        ...countTasks(theirs, now),
      });
    }
    return rows.sort((a, b) => b.pending - a.pending || b.total - a.total);
  }, [users, tasks, now]);

  const attention = useMemo(
    () =>
      tasks
        .filter((t) => isOverdue(t, now) || isDueSoon(t, now))
        .sort(byDeadline)
        .slice(0, 6),
    [tasks, now],
  );

  const firstName = profile?.fullName?.split(" ")[0] ?? "";

  if (loading) return <Spinner label="Loading dashboard" />;

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Departmental overview of every assigned task."
        action={
          <Link href="/tasks/new">
            <Button>New task</Button>
          </Link>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tasks" value={counts.total} href="/tasks" />
        <StatCard
          label="Completed"
          value={counts.completed}
          tone="success"
          href="/tasks"
        />
        <StatCard label="Pending" value={counts.pending} tone="info" href="/tasks" />
        <StatCard label="Overdue" value={counts.overdue} tone="danger" href="/tasks" />
      </div>

      {counts.declined > 0 ? (
        <p className="mt-3 text-sm text-muted">
          {counts.declined} task{counts.declined === 1 ? " has" : "s have"} been declined
          by a lecturer with a reason.{" "}
          <Link href="/tasks" className="font-medium text-brand-600 hover:underline">
            Review them
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Workload by lecturer
          </h2>
          {workload.length === 0 ? (
            <EmptyState
              title="No lecturers yet"
              description="Ask an administrator to add lecturer accounts, then assign work."
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Lecturer</th>
                    <th className="px-4 py-3 font-medium">Open</th>
                    <th className="px-4 py-3 font-medium">Overdue</th>
                    <th className="px-4 py-3 font-medium">Done</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {workload.map((row) => {
                    const busiest = Math.max(...workload.map((r) => r.total), 1);
                    return (
                      <tr key={row.lecturer.uid}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{row.lecturer.fullName}</p>
                          <p className="text-xs text-muted">
                            {row.total} task{row.total === 1 ? "" : "s"} in total
                          </p>
                        </td>
                        <td className="px-4 py-3 text-ink">{row.pending}</td>
                        <td
                          className={cx(
                            "px-4 py-3",
                            row.overdue > 0 ? "font-medium text-red-600" : "text-muted",
                          )}
                        >
                          {row.overdue}
                        </td>
                        <td className="px-4 py-3 text-muted">{row.completed}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {/* Simple bar so uneven distribution is visible at a glance. */}
                          <span className="block h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full bg-brand-500"
                              style={{ width: `${(row.total / busiest) * 100}%` }}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-ink">Needs attention</h2>
          {attention.length === 0 ? (
            <EmptyState
              title="Nothing urgent"
              description="No task is overdue or due within 24 hours."
            />
          ) : (
            <TaskList>
              {attention.map((task: Task) => (
                <TaskRow key={task.id} task={task} href={`/tasks/${task.id}`} now={now} />
              ))}
            </TaskList>
          )}
        </section>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
  href,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "info" | "danger";
  href: string;
}) {
  const tones = {
    default: "text-ink",
    success: "text-emerald-600",
    info: "text-brand-600",
    danger: value > 0 ? "text-red-600" : "text-ink",
  } as const;

  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className={cx("mt-1 text-3xl font-semibold tabular-nums", tones[tone])}>
          {value}
        </p>
      </Card>
    </Link>
  );
}
