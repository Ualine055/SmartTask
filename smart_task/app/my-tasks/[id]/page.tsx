"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Protected } from "@/components/protected";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Spinner,
  Textarea,
} from "@/components/ui";
import { db } from "@/lib/firebase/client";
import { useTask } from "@/lib/hooks/use-tasks";
import { authErrorMessage } from "@/lib/auth-errors";
import { notifyTask } from "@/lib/notify";
import { displayStatus, formatDateTime, isOverdue, relativeToNow } from "@/lib/tasks";
import type { Status, Task } from "@/lib/types";

export default function MyTaskDetailPage() {
  return (
    <Protected roles={["lecturer"]}>
      <MyTaskDetail />
    </Protected>
  );
}

function MyTaskDetail() {
  const params = useParams<{ id: string }>();
  const { task, loading, notFound, error } = useTask(params?.id);

  if (loading) return <Spinner label="Loading task" />;

  if (notFound || !task) {
    return (
      <EmptyState
        title="Task not available"
        description="This task does not exist, or it is not assigned to you."
        action={
          <Link href="/my-tasks">
            <Button color="white">Back to my tasks</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Link
        href="/my-tasks"
        className="mb-4 inline-block text-sm text-muted hover:text-ink hover:underline"
      >
        ← My tasks
      </Link>

      <PageHeader
        title={task.title}
        description={`Assigned by ${task.assignedByName}`}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={displayStatus(task)} />
              <PriorityBadge priority={task.priority} />
            </div>

            <h2 className="text-sm font-semibold text-ink">What is being asked</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
              {task.description || "No description was given."}
            </p>
          </Card>

          <UpdatePanel task={task} />
        </div>

        <Card className="h-fit">
          <h2 className="mb-3 text-sm font-semibold text-ink">Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Deadline</dt>
              <dd
                className={
                  isOverdue(task) ? "mt-0.5 font-medium text-red-600" : "mt-0.5 text-ink"
                }
              >
                {formatDateTime(task.deadline)}
                <span className="block text-xs font-normal text-muted">
                  {relativeToNow(task.deadline)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Assigned by</dt>
              <dd className="mt-0.5 text-ink">{task.assignedByName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Received</dt>
              <dd className="mt-0.5 text-ink">{formatDateTime(task.createdAt)}</dd>
            </div>
            {task.completedAt ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Completed</dt>
                <dd className="mt-0.5 text-ink">{formatDateTime(task.completedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </div>
    </>
  );
}

/** Everything a lecturer is allowed to change lives in this one panel. */
function UpdatePanel({ task }: { task: Task }) {
  const [progressNote, setProgressNote] = useState(task.progressNote ?? "");
  const [declineReason, setDeclineReason] = useState(task.declineReason ?? "");
  const [showDecline, setShowDecline] = useState(task.status === "cannot_complete");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function apply(
    changes: Partial<Record<"status" | "progressNote" | "declineReason", string>>,
    successMessage: string,
    completedAt: "set" | "clear" | "keep" = "keep",
  ) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        ...changes,
        updatedAt: serverTimestamp(),
        ...(completedAt === "set"
          ? { completedAt: serverTimestamp() }
          : completedAt === "clear"
            ? { completedAt: null }
            : {}),
      });
      setNotice(successMessage);
      // Let the Head of Department know what changed.
      await notifyTask(task.id, "progress");
    } catch (err) {
      setError(authErrorMessage(err, "Could not update the task."));
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (status: Status, message: string) =>
    apply(
      { status, progressNote },
      message,
      status === "completed" ? "set" : status === "incoming" || status === "ongoing" ? "clear" : "keep",
    );

  async function decline() {
    if (!declineReason.trim()) {
      setError("Give a reason before declining — your Head of Department will see it.");
      return;
    }
    await apply(
      { status: "cannot_complete", declineReason: declineReason.trim(), progressNote },
      "The task has been declined and your reason has been sent.",
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-ink">Update your progress</h2>
      <p className="mb-4 mt-1 text-xs text-muted">
        Only you can change the status of this task.
      </p>

      <div className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <Field
          label="Progress note"
          htmlFor="progressNote"
          hint="Visible to your Head of Department."
        >
          <Textarea
            id="progressNote"
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            placeholder="Marked 40 of 60 scripts so far; the rest by Thursday."
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            color="white"
            disabled={busy}
            onClick={() =>
              void apply({ progressNote }, "Progress note saved.")
            }
          >
            Save note
          </Button>

          {task.status !== "ongoing" && task.status !== "completed" ? (
            <Button color="blue"
              disabled={busy}
              onClick={() => void setStatus("ongoing", "Marked as ongoing.")}
            >
              Start working
            </Button>
          ) : null}

          {task.status !== "completed" ? (
            <Button color="blue"
              disabled={busy}
              onClick={() => void setStatus("completed", "Task marked as completed.")}
            >
              Mark complete
            </Button>
          ) : (
            <Button
              color="white"
              disabled={busy}
              onClick={() => void setStatus("ongoing", "Reopened as ongoing.")}
            >
              Reopen task
            </Button>
          )}

          {task.status !== "cannot_complete" ? (
            <Button
              color="white"
              disabled={busy}
              onClick={() => setShowDecline((v) => !v)}
            >
              Cannot complete
            </Button>
          ) : null}
        </div>

        {showDecline || task.status === "cannot_complete" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <Field
              label="Why can you not complete this task?"
              htmlFor="declineReason"
              hint="A reason is required — the task cannot be declined without one."
            >
              <Textarea
                id="declineReason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="I am on approved study leave for the whole of that week."
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button color="red" disabled={busy} onClick={() => void decline()}>
                {task.status === "cannot_complete" ? "Update reason" : "Decline task"}
              </Button>
              {task.status === "cannot_complete" ? (
                <Button
                  color="white"
                  disabled={busy}
                  onClick={() => void setStatus("ongoing", "Task reopened as ongoing.")}
                >
                  Take it on after all
                </Button>
              ) : (
                <Button color="plain" onClick={() => setShowDecline(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
