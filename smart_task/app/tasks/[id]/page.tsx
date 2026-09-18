"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDoc, doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";

import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Protected } from "@/components/protected";
import { TaskForm, type TaskFormValues } from "@/components/task-form";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { db } from "@/lib/firebase/client";
import { useTask } from "@/lib/hooks/use-tasks";
import { authErrorMessage } from "@/lib/auth-errors";
import { notifyTask } from "@/lib/notify";
import { displayStatus, formatDateTime, relativeToNow, toDate } from "@/lib/tasks";

export default function TaskDetailPage() {
  return (
    <Protected roles={["hod"]}>
      <TaskDetail />
    </Protected>
  );
}

function TaskDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { task, loading, notFound, error } = useTask(params?.id);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <Spinner label="Loading task" />;

  if (notFound || !task) {
    return (
      <EmptyState
        title="Task not found"
        description="It may have been deleted."
        action={
          <Link href="/tasks">
            <Button variant="secondary">Back to all tasks</Button>
          </Link>
        }
      />
    );
  }

  async function saveEdits(values: TaskFormValues) {
    if (!task) return;
    try {
      // Only the fields firestore.rules lets a HoD touch. `status` is absent on
      // purpose: progress is the assigned lecturer's to report.
      await updateDoc(doc(db, "tasks", task.id), {
        title: values.title,
        description: values.description,
        assignedTo: values.assignedTo,
        assignedToName: values.assignedToName,
        priority: values.priority,
        deadline: Timestamp.fromDate(values.deadline),
        updatedAt: serverTimestamp(),
      });
      // Only worth an email when the work changed hands.
      if (values.assignedTo !== task.assignedTo) {
        await notifyTask(task.id, "assigned");
      }
      setEditing(false);
    } catch (err) {
      throw new Error(authErrorMessage(err, "Could not save your changes."));
    }
  }

  async function handleDelete() {
    if (!task) return;
    setActionError(null);
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "tasks", task.id));
      router.push("/tasks");
    } catch (err) {
      setActionError(authErrorMessage(err, "Could not delete the task."));
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <>
        <PageHeader title="Edit task" description={task.title} />
        <TaskForm
          submitLabel="Save changes"
          onSubmit={saveEdits}
          onCancel={() => setEditing(false)}
          initial={{
            title: task.title,
            description: task.description,
            assignedTo: task.assignedTo,
            priority: task.priority,
            deadline: toDate(task.deadline) ?? undefined,
          }}
        />
      </>
    );
  }

  return (
    <>
      <Link
        href="/tasks"
        className="mb-4 inline-block text-sm text-muted hover:text-ink hover:underline"
      >
        ← All tasks
      </Link>

      <PageHeader
        title={task.title}
        description={`Assigned to ${task.assignedToName} by ${task.assignedByName}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </div>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      {confirmingDelete ? (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-900">Delete this task?</p>
          <p className="mt-1 text-sm text-red-800">
            It will disappear from {task.assignedToName}&rsquo;s list as well. This cannot
            be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? "Deleting…" : "Yes, delete it"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={displayStatus(task)} />
            <PriorityBadge priority={task.priority} />
          </div>

          <h2 className="text-sm font-semibold text-ink">Description</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
            {task.description || "No description was given."}
          </p>

          <h2 className="mt-5 text-sm font-semibold text-ink">
            Progress reported by {task.assignedToName}
          </h2>
          {task.progressNote ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
              {task.progressNote}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              No progress note has been added yet.
            </p>
          )}

          {task.status === "cannot_complete" ? (
            <div className="mt-5">
              <h2 className="text-sm font-semibold text-ink">Reason for declining</h2>
              <Alert tone="error">{task.declineReason || "No reason given."}</Alert>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Details</h2>
          <dl className="space-y-3 text-sm">
            <Detail label="Deadline">
              {formatDateTime(task.deadline)}
              <span className="block text-xs text-muted">
                {relativeToNow(task.deadline)}
              </span>
            </Detail>
            <Detail label="Assigned to">{task.assignedToName}</Detail>
            <Detail label="Assigned by">{task.assignedByName}</Detail>
            <Detail label="Created">{formatDateTime(task.createdAt)}</Detail>
            <Detail label="Last updated">{formatDateTime(task.updatedAt)}</Detail>
            {task.completedAt ? (
              <Detail label="Completed">{formatDateTime(task.completedAt)}</Detail>
            ) : null}
            <Detail label="Last reminder email">
              {task.lastReminderSentAt ? formatDateTime(task.lastReminderSentAt) : "None sent"}
            </Detail>
          </dl>
        </Card>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
