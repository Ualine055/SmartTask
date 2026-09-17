"use client";

import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";

import { useAuth } from "@/components/auth-provider";
import { Protected } from "@/components/protected";
import { TaskForm, type TaskFormValues } from "@/components/task-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth-errors";

export default function NewTaskPage() {
  return (
    <Protected roles={["hod"]}>
      <NewTask />
    </Protected>
  );
}

function NewTask() {
  const { profile } = useAuth();
  const router = useRouter();

  async function createTask(values: TaskFormValues) {
    if (!profile) return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: values.title,
        description: values.description,
        assignedTo: values.assignedTo,
        assignedToName: values.assignedToName,
        assignedBy: profile.uid,
        assignedByName: profile.fullName,
        priority: values.priority,
        deadline: Timestamp.fromDate(values.deadline),
        // Every task starts here; only the assigned lecturer moves it on.
        status: "incoming",
        progressNote: "",
        declineReason: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completedAt: null,
        lastReminderSentAt: null,
      });
      router.push("/tasks");
    } catch (err) {
      throw new Error(authErrorMessage(err, "Could not create the task."));
    }
  }

  return (
    <>
      <PageHeader
        title="Assign a new task"
        description="The lecturer sees it immediately and is reminded by email before the deadline."
      />
      <TaskForm
        submitLabel="Assign task"
        onSubmit={createTask}
        onCancel={() => router.push("/tasks")}
      />
    </>
  );
}
