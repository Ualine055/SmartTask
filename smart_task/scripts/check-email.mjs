/**
 * Checks the email setup, and optionally sends one real test message.
 *
 *   node --env-file=.env.local scripts/check-email.mjs
 *   node --env-file=.env.local scripts/check-email.mjs someone@example.com
 *
 * Without an address it only reports what is configured. With one it actually
 * sends, which is the quickest way to prove email works before relying on it in
 * a demonstration. It picks the same provider lib/email.ts would.
 */

import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
const usingGmail = Boolean(gmailUser && gmailPass);

const key = process.env.RESEND_API_KEY;
const from = process.env.REMINDER_FROM_EMAIL || "SmartTask <onboarding@resend.dev>";
const to = process.argv[2];

console.log("GMAIL_USER          ", gmailUser || "(unset)");
console.log("GMAIL_APP_PASSWORD  ", gmailPass ? `set (${gmailPass.length} chars)` : "(unset)");
console.log("RESEND_API_KEY      ", key ? `set (${key.slice(0, 3)}…, ${key.length} chars)` : "(unset)");
console.log("NEXT_PUBLIC_APP_URL ", process.env.NEXT_PUBLIC_APP_URL || "(unset, links will point at localhost)");
console.log("\nProvider in use     ", usingGmail ? "Gmail over SMTP" : key ? "Resend" : "NONE - nothing can send");

if (gmailPass && gmailPass.length !== 16) {
  console.log(
    `\nWarning: a Google app password is 16 characters, this one is ${gmailPass.length}.\n` +
      "Generate one at https://myaccount.google.com/apppasswords - it is not your\n" +
      "Gmail password.",
  );
}

if (!usingGmail && !key) {
  console.log("\nSet either of these in .env.local:");
  console.log("  GMAIL_USER / GMAIL_APP_PASSWORD   delivers to anyone");
  console.log("  RESEND_API_KEY                    account owner only, until a domain is verified");
  process.exit(1);
}

if (!usingGmail && from.includes("onboarding@resend.dev")) {
  console.log(
    "\nNote: with this shared sender and no verified domain, Resend delivers ONLY to\n" +
      "the address that owns the Resend account. Anything else is rejected.",
  );
}

if (!to) {
  console.log("\nPass an address to send a real test:\n  node --env-file=.env.local scripts/check-email.mjs someone@example.com");
  process.exit(0);
}

const subject = "SmartTask test email";
const text = "If you are reading this, SmartTask can send email. Nothing else to do.";

console.log(`\nSending a test email to ${to} …`);

if (usingGmail) {
  try {
    const info = await nodemailer
      .createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass } })
      .sendMail({ from: `SmartTask <${gmailUser}>`, to, subject, text });
    console.log(`Sent. Message id: ${info.messageId}`);
    console.log("Check the inbox (and the spam folder) for 'SmartTask test email'.");
  } catch (error) {
    console.error(`Gmail refused it: ${error.message}`);
    if (String(error.message).includes("535")) {
      console.error(
        "535 means the credentials were rejected. Check that 2-Step Verification is on\n" +
          "and that GMAIL_APP_PASSWORD is the 16-character app password, not the Gmail one.",
      );
    }
    process.exit(1);
  }
} else {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });

  const body = await response.json().catch(() => ({}));

  if (response.ok) {
    console.log(`Sent. Resend id: ${body.id}`);
    console.log("Check the inbox (and the spam folder) for 'SmartTask test email'.");
  } else {
    console.error(`Resend refused it (HTTP ${response.status}): ${body.message ?? JSON.stringify(body)}`);
    if (response.status === 403) {
      console.error("A 403 here usually means the recipient is not the address that owns the Resend account.");
    }
    process.exit(1);
  }
}
