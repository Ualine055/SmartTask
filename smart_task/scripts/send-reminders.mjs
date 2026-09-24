/**
 * Runs the deadline reminder job against the app that is currently running.
 *
 *   npm run remind:dry     report what would be sent, sending nothing
 *   npm run remind         send them
 *
 * The schedule in vercel.json only fires on a deployed site, so locally this
 * is what stands in for it - and in a demonstration it is better anyway,
 * because the reminders arrive when you ask rather than at 06:00.
 */

const secret = process.env.CRON_SECRET;
const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const dry = process.argv.includes("--dry");

if (!secret) {
  console.error("CRON_SECRET is not set in .env.local, so the route will refuse the call.");
  process.exit(1);
}

const url = `${base}/api/cron/reminders?secret=${encodeURIComponent(secret)}${dry ? "&dryRun=1" : ""}`;

console.log(dry ? "DRY RUN - nothing will be sent\n" : "SENDING FOR REAL\n");

let response;
try {
  response = await fetch(url);
} catch {
  console.error(`Could not reach ${base}. Is the app running? Start it with: npm run dev`);
  process.exit(1);
}

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`The route refused it (HTTP ${response.status}): ${body.error ?? JSON.stringify(body)}`);
  process.exit(1);
}

console.log(
  `scanned ${body.scanned}  due or overdue ${body.dueOrOverdue}  ` +
    `attempted ${body.attempted}  sent ${body.sent}\n`,
);

for (const r of body.results ?? []) {
  const state = r.overdue ? "OVERDUE " : "due soon";
  const mark = r.sent ? "sent   " : "not sent";
  console.log(`  ${state}  ${mark}  ${r.to ?? "(no address)"}  ${r.title}`);
  if (!r.sent && r.reason && !dry) console.log(`            ${r.reason}`);
}

if (dry) {
  console.log("\nNothing was sent and no task was marked. Drop :dry to send.");
} else if (body.sent) {
  console.log(
    `\n${body.sent} sent. Each one is now marked, so re-running within 24 hours` +
      " sends nothing - that guard is what makes the job safe to repeat.",
  );
}
