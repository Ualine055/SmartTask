import type { Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

import { ApiError, errorResponse, requireRole } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  assignedHtml,
  assignedSubject,
  assignedText,
  isEmailConfigured,
  progressHtml,
  progressSubject,
  progressText,
  sendEmail,
  type ProgressTone,
} from "@/lib/email";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Status } from "@/lib/types";

/**
 * POST /api/notify/task  { taskId, event: 'assigned' | 'progress' }
 *
 * Sends the "something happened right now" emails:
 *
 *   assigned - a HoD created or reassigned a task -> tell the lecturer
 *   progress - a lecturer changed their own task  -> tell the HoD who assigned it
 *
 * Why this needs a server route at all: every other write in SmartTask goes
 * straight from the browser to Firestore, and the Spark plan has no Cloud
 * Functions, so nothing server-side ever notices those writes. The browser
 * cannot send the mail itself either, because that would mean shipping
 * RESEND_API_KEY to the client. So the page performs its Firestore write and
 * then asks this route to do the emailing.
 *
 * The client is trusted with nothing but the task id. Recipient, wording and
 * status all come from the stored document, read here with the Admin SDK, so a
 * caller cannot use this route to mail arbitrary text to arbitrary people.
 *
 * Failure is deliberately soft: the user's actual change is already saved, so a
 * missing API key or a bounced address returns 200 with `sent: false` rather
 * than an error the page would have to show.
 */

export const dynamic = "force-dynamic";

const EVENTS = ["assigned", "progress"] as const;
type NotifyEvent = (typeof EVENTS)[number];

/** Freshly created tasks write createdAt and updatedAt in the same operation. */
const REASSIGN_THRESHOLD_MS = 5_000;

export async function POST(request: NextRequest) {
  try {
    const caller = await requireRole(request, ["hod", "lecturer"]);

    const body = (await request.json().catch(() => ({}))) as {
      taskId?: string;
      event?: NotifyEvent;
    };
    const taskId = body.taskId?.trim() ?? "";
    const event = body.event;

    if (!taskId) throw new ApiError(400, "A taskId is required.");
    if (!event || !EVENTS.includes(event)) {
      throw new ApiError(400, "Unknown notification event.");
    }

    const db = adminDb();
    const taskSnap = await db.collection("tasks").doc(taskId).get();
    const task = taskSnap.data();
    if (!taskSnap.exists || !task) {
      throw new ApiError(404, "That task no longer exists.");
    }

    // Who is allowed to trigger which notification, and who receives it.
    let recipientUid: string;
    if (event === "assigned") {
      if (caller.role !== "hod") {
        throw new ApiError(403, "Only a Head of Department can assign a task.");
      }
      recipientUid = task.assignedTo as string;
    } else {
      // A lecturer may only announce progress on a task that is actually theirs.
      if (caller.role !== "lecturer" || task.assignedTo !== caller.uid) {
        throw new ApiError(403, "That task is not assigned to you.");
      }
      recipientUid = task.assignedBy as string;
    }

    if (!recipientUid) {
      return Response.json({ sent: false, reason: "The task has no counterpart." });
    }

    const recipientSnap = await db.collection("users").doc(recipientUid).get();
    const recipient = recipientSnap.data();
    if (!recipientSnap.exists || !recipient?.email) {
      return Response.json({
        sent: false,
        reason: "No email address on file for the recipient.",
      });
    }

    if (!isEmailConfigured()) {
      console.warn("[notify/task] RESEND_API_KEY is not set - no email sent.");
      return Response.json({ sent: false, reason: "Email is not configured." });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const deadlineText = formatDeadline(task.deadline as Timestamp | undefined);
    const message =
      event === "assigned"
        ? assignedMessage(task, taskId, appUrl, deadlineText)
        : progressMessage(task, taskId, appUrl, deadlineText, recipient.fullName);

    try {
      await sendEmail({ to: recipient.email as string, ...message });
    } catch (err) {
      // Soft failure: the task change itself is already saved.
      console.error("[notify/task]", err);
      return Response.json({
        sent: false,
        reason: err instanceof Error ? err.message : "The email could not be sent.",
      });
    }

    return Response.json({ sent: true, to: recipient.email });
  } catch (error) {
    return errorResponse(error);
  }
}

function formatDeadline(deadline: Timestamp | undefined): string {
  if (!deadline || typeof deadline.toDate !== "function") return "not set";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(deadline.toDate());
}

function millis(value: unknown): number {
  const ts = value as Timestamp | undefined;
  return ts && typeof ts.toDate === "function" ? ts.toDate().getTime() : 0;
}

function assignedMessage(
  task: Record<string, unknown>,
  taskId: string,
  appUrl: string,
  deadlineText: string,
) {
  // Derived rather than taken from the request, so the wording cannot be faked.
  const created = millis(task.createdAt);
  const updated = millis(task.updatedAt);
  const reassigned = created > 0 && updated - created > REASSIGN_THRESHOLD_MS;

  const ctx = {
    lecturerName: (task.assignedToName as string) || "colleague",
    taskTitle: task.title as string,
    taskDescription: (task.description as string) ?? "",
    deadlineText,
    priority: PRIORITY_LABELS[(task.priority as Priority) ?? "medium"],
    assignedByName: (task.assignedByName as string) || "your Head of Department",
    taskUrl: `${appUrl}/my-tasks/${taskId}`,
    reassigned,
  };

  return {
    subject: assignedSubject(ctx),
    html: assignedHtml(ctx),
    text: assignedText(ctx),
  };
}

function progressMessage(
  task: Record<string, unknown>,
  taskId: string,
  appUrl: string,
  deadlineText: string,
  hodName: unknown,
) {
  const status = (task.status as Status) ?? "incoming";
  const lecturerName = (task.assignedToName as string) || "The assigned lecturer";

  const { tone, headline } = describe(status, lecturerName);

  const ctx = {
    hodName: (hodName as string) || "colleague",
    lecturerName,
    taskTitle: task.title as string,
    statusLabel: STATUS_LABELS[status],
    tone,
    headline,
    progressNote: (task.progressNote as string) ?? "",
    declineReason: (task.declineReason as string) ?? "",
    deadlineText,
    taskUrl: `${appUrl}/tasks/${taskId}`,
  };

  return {
    subject: progressSubject(ctx),
    html: progressHtml(ctx),
    text: progressText(ctx),
  };
}

function describe(
  status: Status,
  lecturerName: string,
): { tone: ProgressTone; headline: string } {
  switch (status) {
    case "completed":
      return { tone: "positive", headline: `${lecturerName} has completed this task` };
    case "cannot_complete":
      return {
        tone: "negative",
        headline: `${lecturerName} cannot complete this task`,
      };
    case "ongoing":
      return {
        tone: "neutral",
        headline: `${lecturerName} has started work on this task`,
      };
    default:
      return { tone: "neutral", headline: `${lecturerName} has updated this task` };
  }
}
