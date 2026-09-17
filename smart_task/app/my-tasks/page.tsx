"use client";

import { useMemo } from "react";

import { useAuth } from "@/components/auth-provider";
import { Protected } from "@/components/protected";
import { TaskList, TaskRow } from "@/components/task-row";
import { Alert, EmptyState, PageHeader, Spinner, cx } from "@/components/ui";
import { useVisibleTasks } from "@/lib/hooks/use-tasks";
import { byDeadline, countTasks, isOverdue } from "@/lib/tasks";
import type { Task } from "@/lib/types";

export default function MyTasksPage() {
  return (
    <Protected roles={["lecturer"]}>
      <MyTasks />
    </Protected>
  );
}

interface Group {
  key: string;
  title: string;
  hint: string;
  tone: "danger" | "default";
  tasks: Task[];
}

function MyTasks() {
  const { profile } = useAuth();
  const { tasks, loading, error } = useVisibleTasks();

  const now = useMemo(() => new Date(), []);

  const { groups, counts } = useMemo(() => {
    const overdue: Task[] = [];
    const incoming: Task[] = [];
    const ongoing: Task[] = [];
    const completed: Task[] = [];
    const declined: Task[] = [];

    for (const task of tasks) {
      // Overdue wins over the stored status so late work is impossible to miss.
      if (isOverdue(task, now)) overdue.push(task);
      else if (task.status === "incoming") incoming.push(task);
      else if (task.status === "ongoing") ongoing.push(task);
      else if (task.status === "completed") completed.push(task);
      else declined.push(task);
    }

    const built: Group[] = [
      {
        key: "overdue",
        title: "Overdue",
        hint: "Past the deadline and still open — deal with these first.",
        tone: "danger",
        tasks: overdue.sort(byDeadline),
      },
      {
        key: "incoming",
        title: "Incoming",
        hint: "Assigned to you but not started yet.",
        tone: "default",
        tasks: incoming.sort(byDeadline),
      },
      {
        key: "ongoing",
        title: "Ongoing",
        hint: "You have started work on these.",
        tone: "default",
        tasks: ongoing.sort(byDeadline),
      },
      {
        key: "completed",
        title: "Completed",
        hint: "Finished and reported to your Head of Department.",
        tone: "default",
        tasks: completed.sort(byDeadline),
      },
      {
        key: "declined",
        title: "Cannot complete",
        hint: "Declined with a reason your Head of Department can see.",
        tone: "default",
        tasks: declined.sort(byDeadline),
      },
    ];

    return { groups: built, counts: countTasks(tasks, now) };
  }, [tasks, now]);

  const firstName = profile?.fullName?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={
          counts.total === 0
            ? "You have no tasks at the moment."
            : `${counts.pending} open · ${counts.overdue} overdue · ${counts.completed} completed`
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <Spinner label="Loading your tasks" />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks assigned yet"
          description="When your Head of Department assigns you a task it will appear here, and you will get an email reminder before it is due."
        />
      ) : (
        <div className="space-y-6">
          {groups
            .filter((group) => group.tasks.length > 0)
            .map((group) => (
              <section key={group.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2
                    className={cx(
                      "text-sm font-semibold",
                      group.tone === "danger" ? "text-red-700" : "text-ink",
                    )}
                  >
                    {group.title}
                  </h2>
                  <span className="text-xs text-muted">({group.tasks.length})</span>
                </div>
                <p className="mb-2 text-xs text-muted">{group.hint}</p>
                <TaskList>
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      href={`/my-tasks/${task.id}`}
                      showAssignee={false}
                      now={now}
                    />
                  ))}
                </TaskList>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
