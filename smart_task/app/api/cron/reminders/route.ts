import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import {
  isEmailConfigured,
  reminderHtml,
  reminderSubject,
  reminderText,
  sendEmail,
  type ReminderContext,
} from "@/lib/email";
import { DUE_SOON_MS } from "@/lib/tasks";
import { PRIORITY_LABELS, type Priority } from "@/lib/types";

/**
 * GET/POST /api/cron/reminders
 *
 * Firebase's free Spark plan does not allow scheduled Cloud Functions, so the
 * schedule lives outside Firebase: Vercel Cron (see vercel.json) calls this
 * route daily at 06:00 - the free Hobby plan allows one cron run per day. Any
 * cron service that can send a header works just as well, and a shorter
 * interval needs only a schedule change.
 *
 * A task gets a reminder when all three hold:
 *   1. the deadline is within the next 24 hours, or has already passed;
 *   2. the status is still 'incoming' or 'ongoing';
 *   3. no reminder has gone out in the last 24 hours.
 *
 * Rule 3 is what makes any schedule safe: re-running this route sends nothing
 * extra, so a duplicated tick, a manual test, or moving to an hourly schedule
 * does no harm. A missed tick is caught by the next run, because a deadline
 * that has already passed still qualifies.
 */

/** Never send more than this in one run - protects the free email quota. */
const MAX_EMAILS_PER_RUN = 50;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; other services
  // may only manage a custom header or a query string.
  const header = request.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  if (request.headers.get("x-cron-secret") === secret) return true;
  if (request.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

async function handle(request: NextRequest) {
  if (!isAuthorised(request)) {
    return Response.json({ error: "Unauthorised." }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  if (!isEmailConfigured() && !dryRun) {
    return Response.json(
      { error: "No email provider is configured, so no email can be sent." },
      { status: 500 },
    );
  }

  const now = new Date();
  const dueSoonCutoff = Timestamp.fromDate(new Date(now.getTime() + DUE_SOON_MS));
  const reminderCutoff = new Date(now.getTime() - DUE_SOON_MS);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const db = adminDb();

    // A single range filter on `deadline` needs no composite index. Status and
    // the last-reminder window are applied below, in memory.
    const snapshot = await db
      .collection("tasks")
      .where("deadline", "<=", dueSoonCutoff)
      .orderBy("deadline")
      .get();

    const candidates = snapshot.docs.filter((docSnap) => {
      const task = docSnap.data();
      if (task.status !== "incoming" && task.status !== "ongoing") return false;

      const last = task.lastReminderSentAt as Timestamp | null | undefined;
      if (last && last.toDate() > reminderCutoff) return false;

      return true;
    });

    const results: Array<{
      taskId: string;
      title: string;
      to?: string;
      overdue: boolean;
      sent: boolean;
      reason?: string;
    }> = [];

    // Cache user lookups: one lecturer usually owns several due tasks.
    const userCache = new Map<string, { email?: string; fullName?: string } | null>();

    async function lookupUser(uid: string) {
      if (!userCache.has(uid)) {
        const userSnap = await db.collection("users").doc(uid).get();
        userCache.set(uid, userSnap.exists ? (userSnap.data() ?? null) : null);
      }
      return userCache.get(uid) ?? null;
    }

    for (const docSnap of candidates.slice(0, MAX_EMAILS_PER_RUN)) {
      const task = docSnap.data();
      const deadline = (task.deadline as Timestamp).toDate();
      const overdue = deadline.getTime() < now.getTime();

      const recipient = await lookupUser(task.assignedTo as string);
      if (!recipient?.email) {
        results.push({
          taskId: docSnap.id,
          title: task.title as string,
          overdue,
          sent: false,
          reason: "No email address on the assigned user.",
        });
        continue;
      }

      const context: ReminderContext = {
        lecturerName: recipient.fullName ?? "colleague",
        taskTitle: task.title as string,
        taskDescription: (task.description as string) ?? "",
        deadlineText: new Intl.DateTimeFormat("en-GB", {
          dateStyle: "full",
          timeStyle: "short",
        }).format(deadline),
        priority: PRIORITY_LABELS[(task.priority as Priority) ?? "medium"],
        assignedByName: (task.assignedByName as string) ?? "your Head of Department",
        taskUrl: `${appUrl}/my-tasks/${docSnap.id}`,
        overdue,
      };

      if (dryRun) {
        results.push({
          taskId: docSnap.id,
          title: context.taskTitle,
          to: recipient.email,
          overdue,
          sent: false,
          reason: "dryRun - nothing was sent and nothing was marked.",
        });
        continue;
      }

      try {
        await sendEmail({
          to: recipient.email,
          subject: reminderSubject(context),
          html: reminderHtml(context),
          text: reminderText(context),
        });
        // Stamped only after a successful send, so a failure is retried next run.
        await docSnap.ref.update({ lastReminderSentAt: FieldValue.serverTimestamp() });
        results.push({
          taskId: docSnap.id,
          title: context.taskTitle,
          to: recipient.email,
          overdue,
          sent: true,
        });
      } catch (err) {
        results.push({
          taskId: docSnap.id,
          title: context.taskTitle,
          to: recipient.email,
          overdue,
          sent: false,
          reason: err instanceof Error ? err.message : "Unknown send failure.",
        });
      }
    }

    return Response.json({
      ranAt: now.toISOString(),
      dryRun,
      scanned: snapshot.size,
      dueOrOverdue: candidates.length,
      attempted: results.length,
      sent: results.filter((r) => r.sent).length,
      skipped: Math.max(candidates.length - MAX_EMAILS_PER_RUN, 0),
      results,
    });
  } catch (error) {
    console.error("[cron/reminders]", error);
    const message =
      error instanceof Error ? error.message : "Reminder run failed unexpectedly.";
    return Response.json({ error: message }, { status: 500 });
  }
}
