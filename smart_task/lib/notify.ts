import { auth } from "./firebase/client";

export type NotifyEvent = "assigned" | "progress";

/**
 * Ask the server to send the email that belongs to a change just written to
 * Firestore - see app/api/notify/task/route.ts for why a server hop is needed.
 *
 * Best-effort on purpose. The task itself is already saved by the time this
 * runs, so a notification that cannot be sent must never turn into an error on
 * a screen where the user's work in fact succeeded. Everything is swallowed and
 * logged instead.
 *
 * Only the task id travels from here; the route derives the recipient and the
 * wording from the stored document.
 */
export async function notifyTask(taskId: string, event: NotifyEvent): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    const response = await fetch("/api/notify/task", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ taskId, event }),
    });

    if (!response.ok) {
      console.warn("[notify] %s returned %d", event, response.status);
      return;
    }

    const result = (await response.json()) as { sent?: boolean; reason?: string };
    if (!result.sent) console.warn("[notify] %s not sent: %s", event, result.reason);
  } catch (error) {
    console.warn("[notify] %s failed", event, error);
  }
}
