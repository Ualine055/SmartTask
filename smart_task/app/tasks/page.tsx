"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Protected } from "@/components/protected";
import { TaskList, TaskRow } from "@/components/task-row";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";
import { useVisibleTasks } from "@/lib/hooks/use-tasks";
import { useUsers } from "@/lib/hooks/use-users";
import { byDeadline, isOverdue } from "@/lib/tasks";
import { STATUSES, STATUS_LABELS } from "@/lib/types";

type StatusFilter = "all" | "overdue" | (typeof STATUSES)[number];

export default function AllTasksPage() {
  return (
    <Protected roles={["hod"]}>
      <AllTasks />
    </Protected>
  );
}

function AllTasks() {
  const { tasks, loading, error } = useVisibleTasks();
  const { users } = useUsers();

  const [lecturerFilter, setLecturerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const lecturers = useMemo(
    () => users.filter((u) => u.role === "lecturer"),
    [users],
  );

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (lecturerFilter !== "all" && task.assignedTo !== lecturerFilter) return false;
        if (statusFilter === "overdue" && !isOverdue(task, now)) return false;
        if (statusFilter !== "all" && statusFilter !== "overdue") {
          if (task.status !== statusFilter) return false;
        }
        if (needle) {
          const haystack =
            `${task.title} ${task.description} ${task.assignedToName}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort(byDeadline);
  }, [tasks, lecturerFilter, statusFilter, search, now]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t, now)).length,
    [tasks, now],
  );

  return (
    <>
      <PageHeader
        title="All tasks"
        description={`${tasks.length} task${tasks.length === 1 ? "" : "s"} in the department${
          overdueCount > 0 ? ` · ${overdueCount} overdue` : ""
        }`}
        action={
          <Link href="/tasks/new">
            <Button color="blue">New task</Button>
          </Link>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Lecturer" htmlFor="lecturer-filter">
          <Select
            id="lecturer-filter"
            value={lecturerFilter}
            onChange={(e) => setLecturerFilter(e.target.value)}
          >
            <option value="all">All lecturers</option>
            {lecturers.map((lecturer) => (
              <option key={lecturer.uid} value={lecturer.uid}>
                {lecturer.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="status-filter">
          <Select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="overdue">Overdue</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Search" htmlFor="task-search">
          <Input
            id="task-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, description or lecturer"
          />
        </Field>
      </div>

      {loading ? (
        <Spinner label="Loading tasks" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? "No tasks created yet" : "No tasks match those filters"}
          description={
            tasks.length === 0
              ? "Assign the first task to a lecturer to get started."
              : "Try clearing the lecturer, status or search filter."
          }
          action={
            tasks.length === 0 ? (
              <Link href="/tasks/new">
                <Button color="blue">Assign a task</Button>
              </Link>
            ) : null
          }
        />
      ) : (
        <TaskList>
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} href={`/tasks/${task.id}`} now={now} />
          ))}
        </TaskList>
      )}

      {!loading && filtered.length > 0 ? (
        <p className="mt-3 text-xs text-muted">
          Showing {filtered.length} of {tasks.length} tasks. “Overdue” is worked out from
          each deadline as the page renders — it is never stored on the task, so it is
          always current, with no nightly job.
        </p>
      ) : null}
    </>
  );
}
