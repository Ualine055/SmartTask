import type { Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

import { ApiError, errorResponse, requireRole } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import * as mail from "@/lib/email";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Status } from "@/lib/types";

/**
 * POST /api/notify/task   { taskId, event: 'assigned' | 'progress' }
 *
 * The "it just happened" emails: a HoD assigns a task -> tell the lecturer;
 * a lecturer reports progress -> tell the HoD who assigned it.
 *
 * Why a server route at all: task writes go straight from the browser to
 * Firestore, and the Spark plan has no Cloud Functions, so nothing server-side
 * ever notices them. The browser cannot send the mail itself either, because
 * that would mean shipping the mail credentials to the client.
 *
 * Only a task id is accepted. The recipient and every word of the email come
 * from the stored document, read here with the Admin SDK - so this route cannot
 * be used to mail arbitrary text to arbitrary people.
 *
 * Failure is soft: the task change is already saved by the time we get here, so
 * "could not send" returns 200 with sent:false rather than an error on a screen
 * where the user's work in fact succeeded.
 */

export const dynamic = "force-dynamic";

/** Stored status -> [colour tone, headline verb] for the email to the HoD. */
const PROGRESS: Record<Status, [mail.ProgressTone, string]> = {
  completed: ["positive", "has completed this task"],
  cannot_complete: ["negative", "cannot complete this task"],
  ongoing: ["neutral", "has started work on this task"],
  incoming: ["neutral", "has updated this task"],
};

/** Firestore timestamp -> Date, tolerating a missing or malformed field. */
function when(value: unknown): Date | null {
  const ts = value as Timestamp | undefined;
  return ts && typeof ts.toDate === "function" ? ts.toDate() : null;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await requireRole(request, ["hod", "lecturer"]);
    const { taskId, event } = (await request.json().catch(() => ({}))) as {
      taskId?: string;
      event?: string;
    };

    if (!taskId) throw new ApiError(400, "A taskId is required.");
    if (event !== "assigned" && event !== "progress") {
      throw new ApiError(400, "Unknown notification event.");
    }

    const db = adminDb();
    const task = (await db.collection("tasks").doc(taskId).get()).data();
    if (!task) throw new ApiError(404, "That task no longer exists.");

    // Who may trigger which notification, and who receives it.
    let recipientUid: string;
    if (event === "assigned") {
      if (caller.role !== "hod") {
        throw new ApiError(403, "Only a Head of Department can assign a task.");
      }
      recipientUid = task.assignedTo;
    } else {
      // A lecturer may only report progress on a task that is actually theirs.
      if (caller.role !== "lecturer" || task.assignedTo !== caller.uid) {
        throw new ApiError(403, "That task is not assigned to you.");
      }
      recipientUid = task.assignedBy;
    }

    const user = recipientUid
      ? (await db.collection("users").doc(recipientUid).get()).data()
      : undefined;
    if (!user?.email) {
      return Response.json({ sent: false, reason: "No email address for the recipient." });
    }
    if (!mail.isEmailConfigured()) {
      console.warn("[notify/task] No email provider is configured - nothing sent.");
      return Response.json({ sent: false, reason: "Email is not configured." });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const deadline = when(task.deadline);
    const deadlineText = deadline
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short" }).format(deadline)
      : "not set";
    const lecturerName = task.assignedToName || "colleague";

    let message: { subject: string; html: string; text: string };

    if (event === "assigned") {
      const ctx = {
        lecturerName,
        taskTitle: task.title,
        taskDescription: task.description ?? "",
        deadlineText,
        priority: PRIORITY_LABELS[(task.priority as Priority) ?? "medium"],
        assignedByName: task.assignedByName || "your Head of Department",
        taskUrl: `${appUrl}/my-tasks/${taskId}`,
        // Derived, never taken from the request, so the wording cannot be faked.
        // A new task writes createdAt and updatedAt in the same operation.
        reassigned:
          (when(task.updatedAt)?.getTime() ?? 0) - (when(task.createdAt)?.getTime() ?? 0) > 5_000,
      };
      message = {
        subject: mail.assignedSubject(ctx),
        html: mail.assignedHtml(ctx),
        text: mail.assignedText(ctx),
      };
    } else {
      const status = (task.status as Status) ?? "incoming";
      const [tone, verb] = PROGRESS[status];
      const ctx = {
        hodName: user.fullName || "colleague",
        lecturerName,
        taskTitle: task.title,
        statusLabel: STATUS_LABELS[status],
        tone,
        headline: `${lecturerName} ${verb}`,
        progressNote: task.progressNote ?? "",
        declineReason: task.declineReason ?? "",
        deadlineText,
        taskUrl: `${appUrl}/tasks/${taskId}`,
      };
      message = {
        subject: mail.progressSubject(ctx),
        html: mail.progressHtml(ctx),
        text: mail.progressText(ctx),
      };
    }

    try {
      await mail.sendEmail({ to: user.email, ...message });
    } catch (err) {
      console.error("[notify/task]", err);
      return Response.json({
        sent: false,
        reason: err instanceof Error ? err.message : "The email could not be sent.",
      });
    }

    return Response.json({ sent: true, to: user.email });
  } catch (error) {
    return errorResponse(error);
  }
}
