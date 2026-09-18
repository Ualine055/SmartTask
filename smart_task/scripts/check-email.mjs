/**
 * Checks the email setup, and optionally sends one real test message.
 *
 *   node --env-file=.env.local scripts/check-email.mjs
 *   node --env-file=.env.local scripts/check-email.mjs you@example.com
 *
 * Without an address it only reports what is configured. With one it actually
 * sends, which is the quickest way to prove Resend works before relying on it
 * in a demonstration.
 */

const key = process.env.RESEND_API_KEY;
const from = process.env.REMINDER_FROM_EMAIL || "SmartTask <onboarding@resend.dev>";
const to = process.argv[2];

console.log("RESEND_API_KEY      ", key ? `set (${key.slice(0, 3)}…, ${key.length} chars)` : "EMPTY - nothing can send");
console.log("REMINDER_FROM_EMAIL ", from);
console.log("NEXT_PUBLIC_APP_URL ", process.env.NEXT_PUBLIC_APP_URL || "(unset, links will point at localhost)");

if (!key) {
  console.log("\nGet a key from https://resend.com (free), then put it in .env.local as:");
  console.log("  RESEND_API_KEY=re_your_key_here");
  process.exit(1);
}

if (from.includes("onboarding@resend.dev")) {
  console.log(
    "\nNote: with this shared sender and no verified domain, Resend delivers ONLY to\n" +
      "the address that owns the Resend account. Anything else is rejected.",
  );
}

if (!to) {
  console.log("\nPass an address to send a real test:\n  node --env-file=.env.local scripts/check-email.mjs you@example.com");
  process.exit(0);
}

console.log(`\nSending a test email to ${to} …`);

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "SmartTask test email",
    text: "If you are reading this, SmartTask can send email. Nothing else to do.",
  }),
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
