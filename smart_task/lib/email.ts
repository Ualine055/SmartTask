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

/* ------------------------------------------------------------- templates */

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const accent = ctx.overdue ? "#dc2626" : "#2b56bd";
  const banner = ctx.overdue
    ? "This task is overdue"
    : "This task is due within 24 hours";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0;font-size:13px;color:#64748b;">SmartTask</p>
          <p style="margin:4px 0 0;font-size:17px;font-weight:bold;color:${accent};">${banner}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;">Hello ${escapeHtml(ctx.lecturerName)},</p>

          <p style="margin:0 0 8px;font-size:16px;font-weight:bold;">${escapeHtml(ctx.taskTitle)}</p>
          ${
            ctx.taskDescription
              ? `<p style="margin:0 0 16px;font-size:14px;color:#475569;">${escapeHtml(ctx.taskDescription)}</p>`
              : ""
          }

          <table role="presentation" style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#64748b;width:110px;">Deadline</td>
              <td style="padding:6px 0;font-weight:bold;color:${accent};">${escapeHtml(ctx.deadlineText)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;">Priority</td>
              <td style="padding:6px 0;">${escapeHtml(ctx.priority)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;">Assigned by</td>
              <td style="padding:6px 0;">${escapeHtml(ctx.assignedByName)}</td>
            </tr>
          </table>

          <p style="margin:24px 0 0;">
            <a href="${ctx.taskUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">
              Open the task
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
