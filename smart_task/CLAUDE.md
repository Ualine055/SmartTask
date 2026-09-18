@AGENTS.md

# SmartTask — project context

Final year project for the School of Computing and IT, University of Kigali.
It will be **defended orally**, so design decisions must be explainable, not just working.

- Full setup, roles, env vars, troubleshooting: [README.md](README.md)
- End-to-end walkthrough written for revision/defence: [../HOW-IT-WORKS.md](../HOW-IT-WORKS.md)

## Constraints that shape the design

- **Firebase free Spark plan.** No scheduled Cloud Functions. Reminders therefore run
  through `/api/cron/reminders`, called by an external cron service, guarded by
  `CRON_SECRET`, with a 24h `lastReminderSentAt` check so re-runs never duplicate email.
- **Security lives in `firestore.rules`, not in React.** The UI hiding a button is
  convenience; the rules run on Google's servers and are the real boundary.
  33 tests cover them — `npm run test:rules`.
- **`overdue` is derived, never stored.** `deadline < now && status in (incoming, ongoing)`,
  via `isOverdue()` in `lib/tasks.ts`. No nightly job, so it can never go stale.
- **Roles come from `users/{uid}.role`**, not from the auth token. `auth-provider.tsx`
  subscribes with `onSnapshot`, so a role change takes effect without logging out.

## Working notes

- `.env.local` holds the Firebase service account key and Resend key. It is gitignored
  and exists **only on this machine** — never commit it.
- Long explanations should be written to a file in the repo, not left in chat.
