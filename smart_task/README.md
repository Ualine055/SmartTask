# SmartTask

**Smart Workplace Task Management and Reminder System**
School of Computing and IT, University of Kigali

Heads of Department assign tasks to lecturers, lecturers report their progress,
and the system emails a reminder before each deadline.

Built with Next.js (App Router) + TypeScript, Tailwind CSS, Firebase
Authentication and Cloud Firestore. It runs within Firebase's free **Spark**
plan.

---

## Contents

1. [What each role can do](#what-each-role-can-do)
2. [Quick start](#quick-start)
3. [Creating the first admin](#creating-the-first-admin)
4. [Environment variables](#environment-variables)
5. [Security rules](#security-rules)
6. [Email reminders](#email-reminders)
7. [Test accounts (seed script)](#test-accounts-seed-script)
8. [Running against the emulators](#running-against-the-emulators)
9. [Deploying to Vercel](#deploying-to-vercel)
10. [Project structure](#project-structure)
11. [Design notes](#design-notes)
12. [Troubleshooting](#troubleshooting)

---

## What each role can do

| Role         | Can do                                                                | Cannot do                                  |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------ |
| **admin**    | Create accounts, assign roles, activate/deactivate users               | Assign departmental tasks                  |
| **hod**      | Create, edit, delete and re-assign tasks; view all tasks and dashboard | Change anyone's role; change a task status |
| **lecturer** | View **only** their own tasks; update progress; complete; decline      | Assign tasks; see another lecturer's tasks |

A new registration is **always** a lecturer. The form offers no role choice, and
the security rules reject any other value, so an account cannot promote itself.

### Pages

| Path              | Who      | Purpose                                                    |
| ----------------- | -------- | ---------------------------------------------------------- |
| `/login`          | anyone   | Email + password sign-in                                   |
| `/register`       | anyone   | Creates a **lecturer** account only                        |
| `/dashboard`      | all      | Redirects by role; the HoD overview lives here             |
| `/admin/users`    | admin    | Roles, activation, account creation                        |
| `/tasks`          | hod      | Every task, filtered by lecturer / status / overdue        |
| `/tasks/new`      | hod      | Assign a task                                              |
| `/tasks/[id]`     | hod      | Task detail, edit, delete                                  |
| `/my-tasks`       | lecturer | Own tasks, grouped Overdue / Incoming / Ongoing / Completed |
| `/my-tasks/[id]`  | lecturer | Update progress, complete, or decline with a reason        |

---

## Quick start

**Requirements:** Node.js 20.9 or newer, a Google account, and (for the rules
tests and emulators) Java 11+.

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and **Add project**. The free
   Spark plan is enough.
2. **Build → Authentication → Get started → Sign-in method →** enable
   **Email/Password**.
3. **Build → Firestore Database → Create database →** start in **production
   mode** and pick a location (`eur3` or `nam5` are both fine).
4. **Project settings (gear icon) → General → Your apps →** click the web icon
   (`</>`), register an app, and copy the `firebaseConfig` values.

### 2. Configure the app

```bash
cd smart_task
npm install
cp .env.local.example .env.local
```

Fill in `.env.local` with the values from step 1. See
[Environment variables](#environment-variables) for what each one is and where
to find it.

### 3. Deploy the security rules

```bash
npx firebase login
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Do this **before** using the app. Without it, Firestore's default production
rules deny everything and every screen will look empty.

### 4. Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## Creating the first admin

There is deliberately no way to register as an admin — otherwise anyone could.
The first admin is promoted by hand, once:

1. Go to <http://localhost:3000/register> and create an account with your own
   email. It will be created as a **lecturer**.
2. Open the Firebase console → **Firestore Database → `users` collection**.
3. Find the document whose `email` matches the account you just created.
4. Change the **`role`** field from `lecturer` to `admin`, and save.
5. Reload the app. You are now an administrator and land on `/admin/users`.

From then on, every other account — including Heads of Department — can be
created and promoted from `/admin/users` inside the app.

> The role change takes effect immediately in any open tab: the app subscribes
> to the signed-in user's document rather than caching the role.

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill it in. Never commit
`.env.local` — it is already in `.gitignore`.

### Firebase web config — required

Firebase console → **Project settings → General → Your apps → Web app**.

| Variable                                   | Example                     |
| ------------------------------------------ | --------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | `AIzaSy…`                   |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | `my-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | `my-project`                |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | `my-project.appspot.com`    |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `123456789`                 |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | `1:123:web:abc`             |

These are public by design — they identify the project, they do not grant
access. Access is decided by `firestore.rules`.

### Service account — required for reminders and admin account creation

Firebase console → **Project settings → Service accounts → Generate new private
key**. This downloads a JSON file; take three values out of it.

| Variable                | From the JSON file                             |
| ----------------------- | ---------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | `project_id`                                   |
| `FIREBASE_CLIENT_EMAIL` | `client_email`                                 |
| `FIREBASE_PRIVATE_KEY`  | `private_key` — keep the quotes and the `\n`s |

`FIREBASE_PRIVATE_KEY` must stay on one line with literal `\n` escapes:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

**These are secret.** Anyone holding them can read and write the whole database,
bypassing the rules. Never expose them to the browser and never commit them.

### Email and cron — required for reminders

| Variable              | Notes                                                    |
| --------------------- | -------------------------------------------------------- |
| `RESEND_API_KEY`      | From <https://resend.com> (free tier)                    |
| `REMINDER_FROM_EMAIL` | A verified sender, e.g. `SmartTask <noreply@yourdomain>` |
| `CRON_SECRET`         | Any long random string — protects the reminder route     |
| `NEXT_PUBLIC_APP_URL` | Used for the link inside reminder emails                 |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The app runs without the email variables — everything except reminder emails
works, including the in-app bell.

---

## Security rules

`firestore.rules` is the real access-control layer. The UI hides buttons for
convenience; the rules are what actually stop a request. They enforce:

1. A user can read their own user document.
2. Only an admin can write the `role` field on any user document.
3. A lecturer can read a task only when `task.assignedTo` is their own uid.
4. A hod or admin can read all tasks.
5. Only a hod can create a task.
6. A lecturer can update only `status`, `progressNote` and `declineReason`, and
   only on tasks assigned to them.
7. Nobody can list the `users` collection unless they are hod or admin.

Beyond those seven, the rules also stop a lecturer moving a deadline, changing a
priority, reassigning a task or faking `lastReminderSentAt`; they stop a HoD
changing a task's status; and they require a written reason before a task can be
declined.

### Testing the rules

The rules have a test suite that runs against the Firestore emulator. Java 11+
must be installed and on your `PATH`.

```bash
npm run test:rules
```

33 tests, covering each of the seven guarantees plus the traps above.

### Deploying the rules

```bash
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Re-run this after any edit to `firestore.rules`. The file in the repository is
the source of truth — do not edit rules in the console.

### About queries and rules

Rule 3 means a lecturer's query **must** be narrowed:

```ts
query(collection(db, "tasks"), where("assignedTo", "==", uid));
```

An unfiltered `collection("tasks")` query from a lecturer is rejected by the
server, not merely filtered afterwards. That is why `useVisibleTasks()` adds the
constraint rather than fetching everything and hiding rows.

---

## Email reminders

A reminder is sent when all three of these hold:

1. the deadline is within the next 24 hours, or has already passed;
2. the status is still `incoming` or `ongoing`;
3. no reminder has gone out for that task in the last 24 hours.

Point 3 is what makes re-running the job harmless.

### Why an API route instead of a Cloud Function

Scheduled Cloud Functions require the paid Blaze plan. Instead the schedule
lives outside Firebase and calls `/api/cron/reminders`, which is protected by
`CRON_SECRET`. It accepts the secret three ways, so it works with any cron
service:

```
Authorization: Bearer <CRON_SECRET>     # what Vercel Cron sends
x-cron-secret: <CRON_SECRET>
/api/cron/reminders?secret=<CRON_SECRET>
```

### Trying it locally

```bash
# See what would be sent, without sending anything or marking any task:
curl "http://localhost:3000/api/cron/reminders?secret=YOUR_CRON_SECRET&dryRun=1"

# Send for real:
curl "http://localhost:3000/api/cron/reminders?secret=YOUR_CRON_SECRET"
```

The response reports what was scanned, attempted, sent and skipped, with a
per-task reason for anything not sent.

### Scheduling it

**Vercel Cron** — `vercel.json` is already configured and Vercel injects the
`Authorization` header from the `CRON_SECRET` environment variable. Note that
the Vercel Hobby plan runs cron jobs **once a day**; the committed schedule is
06:00 UTC.

**Any free cron service** (e.g. <https://cron-job.org>) — for hourly reminders
on a free plan, point it at:

```
https://your-app.vercel.app/api/cron/reminders?secret=YOUR_CRON_SECRET
```

Hourly is a better fit for a 24-hour warning, and rule 3 above keeps it from
sending anything twice.

### Resend's test sender

`onboarding@resend.dev` works immediately but can only deliver to the email
address that owns the Resend account — which is fine for a demonstration. To
email real lecturers, verify a domain in Resend and set `REMINDER_FROM_EMAIL` to
an address on it.

---

## Test accounts (seed script)

Creates one account per role plus eight tasks covering every state — overdue,
due within 24 hours, ongoing, completed and declined.

```bash
npm run seed
```

(Equivalently: `node --env-file=.env.local scripts/seed.mjs`.)

| Role              | Email                 |
| ----------------- | --------------------- |
| Administrator     | `admin@uok.ac.rw`     |
| Head of Department| `hod@uok.ac.rw`       |
| Lecturer          | `lecturer1@uok.ac.rw` |
| Lecturer          | `lecturer2@uok.ac.rw` |
| Lecturer          | `lecturer3@uok.ac.rw` |

Password for all of them: `Password123!`

Re-running replaces the demo tasks rather than duplicating them. `npm run seed --
--wipe` clears **every** task first, including ones created through the UI.

> The seed script needs the service-account variables, because creating accounts
> and writing on someone else's behalf is exactly what the security rules forbid
> from the browser.

---

## Running against the emulators

Useful for development and for demonstrating the app without touching a real
project. Requires Java 11+.

```bash
# Terminal 1 - Auth on :9099, Firestore on :8080, UI on :4000
npm run emulators

# Terminal 2 - fill the emulators with the demo accounts and tasks
npm run seed:emulator
```

Then add this to `.env.local` and restart `npm run dev`:

```
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_PROJECT_ID=demo-smarttask
```

No service account is needed in this mode. Remember to remove those four lines
before pointing the app back at the real project.

---

## Deploying to Vercel

1. Push the repository to GitHub.
2. On <https://vercel.com>, **Add New → Project**, import the repository, and
   set the **Root Directory** to `smart_task`.
3. Add every variable from `.env.local` under **Settings → Environment
   Variables**. For `FIREBASE_PRIVATE_KEY`, paste the value complete with its
   `\n` escapes.
4. Set `NEXT_PUBLIC_APP_URL` to the deployed URL, e.g.
   `https://smarttask.vercel.app`.
5. Deploy. `vercel.json` registers the reminder cron automatically.
6. In the Firebase console, add your Vercel domain under **Authentication →
   Settings → Authorized domains**.

---

## Project structure

```
smart_task/
├── app/
│   ├── layout.tsx                  root layout, wraps everything in AuthProvider
│   ├── page.tsx                    redirects to /dashboard
│   ├── login/ register/            signed-out screens
│   ├── dashboard/                  role redirect + HoD overview
│   ├── admin/users/                admin: roles and activation
│   ├── tasks/                      hod: list, new, detail/edit/delete
│   ├── my-tasks/                   lecturer: grouped list and detail
│   └── api/
│       ├── admin/users/route.ts    admin-only account creation (Admin SDK)
│       └── cron/reminders/route.ts the reminder job
├── components/
│   ├── auth-provider.tsx           auth + live profile subscription
│   ├── protected.tsx               role gate for a page
│   ├── app-shell.tsx               header, nav, signed-in user's name
│   ├── notification-bell.tsx       in-app due-soon / overdue count
│   ├── task-form.tsx               shared create/edit form
│   ├── task-row.tsx  badges.tsx  ui.tsx
├── lib/
│   ├── firebase/client.ts          browser SDK (+ emulator wiring)
│   ├── firebase/admin.ts           server SDK, credentials handling
│   ├── api-auth.ts                 ID-token verification for API routes
│   ├── tasks.ts                    derived overdue / due-soon / counts
│   ├── email.ts                    Resend client and templates
│   ├── types.ts                    roles, statuses, document shapes
│   └── hooks/                      live Firestore subscriptions
├── tests/rules.test.mjs            33 security-rules tests
├── scripts/seed.mjs                demo accounts and tasks
├── firestore.rules                 ← the real permission boundary
├── firebase.json                   rules, indexes and emulator ports
└── vercel.json                     reminder cron schedule
```

### Scripts

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Development server on :3000                   |
| `npm run build`      | Production build                              |
| `npm run lint`       | ESLint                                        |
| `npm run test:rules` | Security-rules tests (needs Java)             |
| `npm run seed`       | Demo accounts and tasks in the real project   |
| `npm run emulators`  | Local Auth + Firestore emulators              |
| `npm run seed:emulator` | Demo data into the emulators               |

---

## Design notes

### `overdue` is computed, never stored

The `status` field only ever holds `incoming`, `ongoing`, `completed` or
`cannot_complete`. A task is overdue when:

```
deadline < now  AND  status is 'incoming' or 'ongoing'
```

Storing an `overdue` status would need a job to flip every task at midnight —
more infrastructure, and wrong for as long as the job is late or fails. Deriving
it at render time (`isOverdue()` in `lib/tasks.ts`) is always correct and costs
nothing. The same function drives the task lists, the dashboard counts, the
notification bell and the reminder job, so they can never disagree.

### Denormalised names

Tasks store `assignedToName` and `assignedByName` alongside the uids. A list of
40 tasks renders from one query instead of 41. Names change rarely; when a HoD
re-assigns a task the name is rewritten with it.

### No composite indexes

Every query is a single equality or a single range, so Firestore's automatic
indexes cover them and there is nothing to configure. Filtering and sorting
happen in memory, which is appropriate at departmental scale.

### Why some writes go through an API route

Two things cannot be done from the browser:

- **Creating an account for someone else.** `createUserWithEmailAndPassword()`
  signs the *current* user out and in as the new account — an admin creating a
  lecturer would lose their own session. `/api/admin/users` uses the Admin SDK
  instead, after verifying the caller's ID token and re-checking their role
  server-side.
- **Scanning every lecturer's tasks** for the reminder job, which no signed-in
  user is allowed to do.

Everything else — creating tasks, updating status, changing roles — is a direct
Firestore write, checked by the rules.

---

## Troubleshooting

**"Firebase is not configured"**
`.env.local` is missing or empty. Copy `.env.local.example`, fill it in, and
restart the dev server — `NEXT_PUBLIC_*` variables are read at build time.

**Everything loads but all lists are empty; the console shows
`permission-denied`**
The security rules have not been deployed:
`npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.

**"Your account has no profile yet"**
The Auth account exists but `users/{uid}` does not — usually a registration that
failed halfway. Delete the account under **Authentication → Users** and register
again, or create the document by hand.

**A new user cannot see anything / "Account deactivated"**
Check `isActive` on their user document. An admin can flip it on
`/admin/users`.

**`npm run test:rules` says "Could not spawn java"**
Java is not on the `PATH` that Node sees. Install a JDK, then set `JAVA_HOME`
and add `%JAVA_HOME%\bin` to your `PATH`, and open a new terminal.

**Reminder emails are not arriving**

- Check `RESEND_API_KEY` is set and the route returns `"sent": 1` or more.
- With `onboarding@resend.dev` as the sender, Resend only delivers to the
  account owner's address.
- A task is skipped if it already got a reminder within 24 hours — look at
  `lastReminderSentAt`, which is shown on the HoD's task detail page.
- Add `&dryRun=1` to see which tasks qualify without sending anything.

**Build fails with `Cannot find module '@opentelemetry/api'`**
Run `npm install` — it is a required peer of `firebase-admin`'s Firestore
client and is already listed in `package.json`.
