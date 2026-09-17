"use client";

import { useState, type FormEvent } from "react";

import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "./ui";
import { useAssignableLecturers } from "@/lib/hooks/use-users";
import { toDateTimeLocalValue } from "@/lib/tasks";
import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@/lib/types";

export interface TaskFormValues {
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  priority: Priority;
  /** Local wall-clock time, converted to a Timestamp by the caller. */
  deadline: Date;
}

export interface TaskFormInitial {
  title?: string;
  description?: string;
  assignedTo?: string;
  priority?: Priority;
  deadline?: Date;
}

/** Default deadline: one week from now, rounded to the next hour. */
function defaultDeadline(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

export function TaskForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: TaskFormInitial;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const { users: lecturers, loading: lecturersLoading, error: lecturersError } =
    useAssignableLecturers();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [deadline, setDeadline] = useState(
    toDateTimeLocalValue(initial?.deadline ?? defaultDeadline()),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const lecturer = lecturers.find((u) => u.uid === assignedTo);
    if (!lecturer) {
      setError("Choose the lecturer this task is for.");
      return;
    }
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      setError("Enter a valid deadline.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        assignedTo: lecturer.uid,
        // Denormalised so task lists render without a second read per row.
        assignedToName: lecturer.fullName,
        priority,
        deadline: deadlineDate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the task.");
      setSubmitting(false);
    }
  }

  if (lecturersLoading) return <Spinner label="Loading lecturers" />;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {lecturersError ? <Alert tone="error">{lecturersError}</Alert> : null}

        {lecturers.length === 0 ? (
          <Alert tone="info">
            There are no active lecturer accounts yet, so there is nobody to assign
            work to. Ask an administrator to add lecturers first.
          </Alert>
        ) : null}

        <Field label="Task title" htmlFor="title">
          <Input
            id="title"
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Submit CS301 continuous assessment marks"
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          hint="What exactly is expected, and where it should be submitted."
        >
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Upload the marked CAT scripts and the mark sheet to the departmental drive."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assign to" htmlFor="assignedTo">
            <Select
              id="assignedTo"
              required
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Select a lecturer…</option>
              {lecturers.map((lecturer) => (
                <option key={lecturer.uid} value={lecturer.uid}>
                  {lecturer.fullName}
                  {lecturer.department ? ` — ${lecturer.department}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" htmlFor="priority">
            <Select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Deadline"
          htmlFor="deadline"
          hint="A reminder email goes out 24 hours before this time, and again once it passes."
        >
          <Input
            id="deadline"
            type="datetime-local"
            required
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={submitting || lecturers.length === 0}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
