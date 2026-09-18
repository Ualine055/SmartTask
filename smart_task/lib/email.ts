/**
 * Minimal Resend client.
 *
 * Called with fetch rather than the `resend` npm package on purpose: it is one
 * HTTP POST, and keeping the dependency list short makes the project easier to
 * install and mark. Swapping in another provider means changing this file only.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

  const from = process.env.REMINDER_FROM_EMAIL || "SmartTask <onboarding@resend.dev>";

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend rejected the email (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
}

/* ---------------------------------------------------------------- templates */

/** Colours for the header strip and the call-to-action button. */
const ACCENT = {
  brand: "#2b56bd",
  danger: "#dc2626",
  success: "#15803d",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface DetailRow {
  label: string;
  value: string;
  /** Renders the value bold and in the accent colour. */
  strong?: boolean;
}

interface Shell {
  accent: string;
  banner: string;
  greetingName: string;
  heading: string;
  body?: string;
  rows: DetailRow[];
  ctaUrl: string;
  ctaLabel: string;
}

/**
 * The one HTML frame every SmartTask email uses: header strip, greeting,
 * heading, optional paragraph, a label/value table and a button.
 *
 * Table-based and inline-styled because that is what mail clients reliably
 * render - Outlook ignores <style> blocks and modern layout entirely.
 */
function shell(parts: Shell): string {
  const rows = parts.rows
    .map(
      (row, index) => `
            <tr>
              <td style="padding:6px 0;color:#64748b;${index === 0 ? "width:110px;" : ""}">${escapeHtml(row.label)}</td>
              <td style="padding:6px 0;${row.strong ? `font-weight:bold;color:${parts.accent};` : ""}">${escapeHtml(row.value)}</td>
            </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0;font-size:13px;color:#64748b;">SmartTask</p>
          <p style="margin:4px 0 0;font-size:17px;font-weight:bold;color:${parts.accent};">${parts.banner}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;">Hello ${escapeHtml(parts.greetingName)},</p>

          <p style="margin:0 0 8px;font-size:16px;font-weight:bold;">${escapeHtml(parts.heading)}</p>
          ${
            parts.body
              ? `<p style="margin:0 0 16px;font-size:14px;color:#475569;">${escapeHtml(parts.body)}</p>`
              : ""
          }

          <table role="presentation" style="width:100%;font-size:14px;border-collapse:collapse;">${rows}
          </table>

          <p style="margin:24px 0 0;">
            <a href="${parts.ctaUrl}" style="display:inline-block;background:${parts.accent};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">
              ${parts.ctaLabel}
            </a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          School of Computing and IT, University of Kigali
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text twin of the HTML shell, for clients that refuse HTML. */
function plain(lines: (string | false | null | undefined)[]): string {
  const kept = lines.filter((line): line is string => typeof line === "string");
  return [...kept, "", "SmartTask — School of Computing and IT, University of Kigali"].join(
    "\n",
  );
}

/* ---------------------------------------------- 1. deadline reminder (cron) */

export interface ReminderContext {
  lecturerName: string;
  taskTitle: string;
  taskDescription: string;
  deadlineText: string;
  priority: string;
  assignedByName: string;
  taskUrl: string;
  overdue: boolean;
}

export function reminderSubject(ctx: ReminderContext): string {
  return ctx.overdue
    ? `Overdue: ${ctx.taskTitle}`
    : `Due in 24 hours: ${ctx.taskTitle}`;
}

export function reminderText(ctx: ReminderContext): string {
  const opening = ctx.overdue
    ? `The deadline for the task below has passed and it is still open.`
    : `This is a reminder that the task below is due within the next 24 hours.`;

  return [
    `Hello ${ctx.lecturerName},`,
    "",
    opening,
    "",
    `Task:       ${ctx.taskTitle}`,
    `Deadline:   ${ctx.deadlineText}`,
    `Priority:   ${ctx.priority}`,
    `Assigned by: ${ctx.assignedByName}`,
    ctx.taskDescription ? `\n${ctx.taskDescription}` : "",
    "",
    `Open the task: ${ctx.taskUrl}`,
    "",
    "SmartTask — School of Computing and IT, University of Kigali",
  ].join("\n");
}

export function reminderHtml(ctx: ReminderContext): string {
  return shell({
    accent: ctx.overdue ? ACCENT.danger : ACCENT.brand,
    banner: ctx.overdue ? "This task is overdue" : "This task is due within 24 hours",
    greetingName: ctx.lecturerName,
    heading: ctx.taskTitle,
    body: ctx.taskDescription || undefined,
    rows: [
      { label: "Deadline", value: ctx.deadlineText, strong: true },
      { label: "Priority", value: ctx.priority },
      { label: "Assigned by", value: ctx.assignedByName },
    ],
    ctaUrl: ctx.taskUrl,
    ctaLabel: "Open the task",
  });
}

/* --------------------------------- 2. a task was assigned (to the lecturer) */

export interface AssignedContext {
  lecturerName: string;
  taskTitle: string;
  taskDescription: string;
  deadlineText: string;
  priority: string;
  assignedByName: string;
  taskUrl: string;
  /** True when an existing task was handed over, rather than newly created. */
  reassigned: boolean;
}

export function assignedSubject(ctx: AssignedContext): string {
  return ctx.reassigned
    ? `Task reassigned to you: ${ctx.taskTitle}`
    : `New task assigned: ${ctx.taskTitle}`;
}

export function assignedText(ctx: AssignedContext): string {
  return plain([
    `Hello ${ctx.lecturerName},`,
    "",
    ctx.reassigned
      ? `${ctx.assignedByName} has reassigned the task below to you.`
      : `${ctx.assignedByName} has assigned you a new task.`,
    "",
    `Task:        ${ctx.taskTitle}`,
    `Deadline:    ${ctx.deadlineText}`,
    `Priority:    ${ctx.priority}`,
    `Assigned by: ${ctx.assignedByName}`,
    ctx.taskDescription ? `\n${ctx.taskDescription}` : "",
    "",
    `Open the task: ${ctx.taskUrl}`,
  ]);
}

export function assignedHtml(ctx: AssignedContext): string {
  return shell({
    accent: ACCENT.brand,
    banner: ctx.reassigned ? "A task has been reassigned to you" : "You have a new task",
    greetingName: ctx.lecturerName,
    heading: ctx.taskTitle,
    body: ctx.taskDescription || undefined,
    rows: [
      { label: "Deadline", value: ctx.deadlineText, strong: true },
      { label: "Priority", value: ctx.priority },
      { label: "Assigned by", value: ctx.assignedByName },
    ],
    ctaUrl: ctx.taskUrl,
    ctaLabel: "Open the task",
  });
}

/* ---------------------------- 3. a lecturer reported progress (to the HoD) */

export type ProgressTone = "positive" | "negative" | "neutral";

export interface ProgressContext {
  /** The Head of Department receiving this. */
  hodName: string;
  lecturerName: string;
  taskTitle: string;
  statusLabel: string;
  tone: ProgressTone;
  /** Headline sentence, e.g. "Aline Uwineza has completed this task". */
  headline: string;
  progressNote: string;
  declineReason: string;
  deadlineText: string;
  taskUrl: string;
}

export function progressSubject(ctx: ProgressContext): string {
  return `${ctx.statusLabel}: ${ctx.taskTitle} — ${ctx.lecturerName}`;
}

export function progressText(ctx: ProgressContext): string {
  return plain([
    `Hello ${ctx.hodName},`,
    "",
    ctx.headline,
    "",
    `Task:     ${ctx.taskTitle}`,
    `Lecturer: ${ctx.lecturerName}`,
    `Status:   ${ctx.statusLabel}`,
    `Deadline: ${ctx.deadlineText}`,
    ctx.progressNote ? `\nProgress note:\n${ctx.progressNote}` : "",
    ctx.declineReason ? `\nReason given for declining:\n${ctx.declineReason}` : "",
    "",
    `Open the task: ${ctx.taskUrl}`,
  ]);
}

export function progressHtml(ctx: ProgressContext): string {
  const accent =
    ctx.tone === "positive"
      ? ACCENT.success
      : ctx.tone === "negative"
        ? ACCENT.danger
        : ACCENT.brand;

  return shell({
    accent,
    banner: ctx.headline,
    greetingName: ctx.hodName,
    heading: ctx.taskTitle,
    body: ctx.declineReason || ctx.progressNote || undefined,
    rows: [
      { label: "Lecturer", value: ctx.lecturerName },
      { label: "Status", value: ctx.statusLabel, strong: true },
      { label: "Deadline", value: ctx.deadlineText },
    ],
    ctaUrl: ctx.taskUrl,
    ctaLabel: "Open the task",
  });
}
