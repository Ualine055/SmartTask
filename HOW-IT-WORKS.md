# SmartTask — How the System Works

*Smart Workplace Task Management and Reminder System — School of Computing and IT, University of Kigali.*

The whole system, end to end, in the order you'd present it.

---

# 1. The problem it solves

In the School of Computing and IT, a Head of Department hands out work — set an exam paper, submit marks, attend a workshop. Today that happens by email or in person, so there's no record of who was asked what, no visibility into progress, and deadlines get missed because nothing reminds anyone.

SmartTask makes that flow explicit: **assign → track → remind**.

Three kinds of people use it:

| Who | What they do |
|---|---|
| **Admin** | Manages accounts and roles. Doesn't touch tasks. |
| **HoD** | Assigns tasks, sees everything, monitors workload. |
| **Lecturer** | Sees only their own tasks, reports progress. |

---

# 2. The architecture

The important thing to understand: **the browser talks to Firebase directly.** There's no traditional backend sitting in the middle.

```
┌──────────────┐
│   Browser    │  Next.js pages (React)
│              │
│  ┌────────┐  │   reads/writes ───────►┌─────────────────┐
│  │Firebase│──┼───────────────────────►│  Cloud Firestore│
│  │  SDK   │  │◄───live updates────────│  (the database) │
│  └────────┘  │                        └────────┬────────┘
│              │                                 │
│              │   sign in ────────────►┌────────▼────────┐
└──────────────┘                        │ firestore.rules │
       │                                │ CHECKS EVERY    │
       │                                │ READ AND WRITE  │
       │                                └─────────────────┘
       │
       │  only these go through a server:
       ▼
┌───────────────────────────┐
│  Next.js API routes       │
│  /api/admin/users         │  create an account
│  /api/cron/reminders      │  deadline reminder emails
│  /api/notify/task         │  "it just happened" emails
└───────────────────────────┘
```

So Next.js mostly just **serves the pages**. The data flows straight from the browser to Firestore.

**"But isn't that insecure?"** — this is the question you'll be asked, and the answer is section 7.

---

# 3. The data — only two collections

### `users/{uid}`

One document per person. The document ID *is* their Firebase Auth uid, which links the login to the profile.

```
fullName, email, role, department, isActive, createdAt
```

`role` is one of `admin` | `hod` | `lecturer`. `isActive: false` locks someone out without deleting their history.

### `tasks/{taskId}`

```
title, description
assignedTo      ← uid of the lecturer
assignedToName  ← their name, copied in
assignedBy      ← uid of the HoD
assignedByName
priority        low | medium | high
deadline
status          incoming | ongoing | completed | cannot_complete
progressNote, declineReason
createdAt, updatedAt, completedAt, lastReminderSentAt
```

**Why store the name as well as the uid?** If a list of 40 tasks only had uids, showing names would need 40 extra database reads. Copying the name in makes it one read. This is called *denormalisation* — trading a little duplication for a lot of speed. When a HoD reassigns a task, the name is rewritten with it.

---

# 4. Signing in — what actually happens

```
1. User types email + password
        ↓
2. Firebase Authentication verifies it
   → returns a signed token proving "this is uid abc123"
        ↓
3. App fetches users/abc123
   → discovers role = "hod"
        ↓
4. App sends them to the right home page
```

Step 3 is important: **the role lives in the database, not in the login.** Firebase Auth only proves *who* you are. What you're *allowed to do* comes from your user document.

The code for this is [auth-provider.tsx](smart_task/components/auth-provider.tsx). It uses a **live subscription** (`onSnapshot`), not a one-time read — so if an admin changes your role or deactivates you, it takes effect in your open tab within a second. No logout needed.

---

# 5. Role-based routing

`/dashboard` is the single landing page after login. It looks at your role and forwards you:

| Role | Goes to |
|---|---|
| admin | `/admin/users` |
| hod | stays on `/dashboard` |
| lecturer | `/my-tasks` |

Every protected page wraps itself in `<Protected roles={[...]}>`. If a lecturer types `/tasks/new` into the address bar, they get "Not available for your role."

**But that's convenience, not security** — see the next section.

---

# 6. The task lifecycle

```
        HoD creates it
              ↓
        ┌──────────┐
        │ INCOMING │  lecturer hasn't started
        └────┬─────┘
             │ "Start working"
             ▼
        ┌──────────┐
        │ ONGOING  │  in progress
        └────┬─────┘
             │
      ┌──────┴────────┐
      ▼               ▼
┌───────────┐  ┌────────────────┐
│ COMPLETED │  │ CANNOT_COMPLETE│ ← reason REQUIRED
└───────────┘  └────────────────┘
```

**Only the assigned lecturer can move a task through these states.** The HoD can edit the title, deadline, priority, or reassign it — but cannot mark it complete. That's deliberate: progress reporting belongs to the person doing the work, otherwise the data is meaningless.

---

# 7. Security — the heart of the project

> **Hiding a button is not security.**

If protection were only in the React code, anyone could open DevTools and run:

```js
getDocs(collection(db, "tasks"))
```

…and read every lecturer's tasks. The UI can't stop that, because the UI runs on *their* computer.

So the real protection is **[firestore.rules](smart_task/firestore.rules)** — a file that runs on Google's servers and checks every single read and write.

Example, rule 3:

```
allow read: if isStaff()
            || (isLecturer() && resource.data.assignedTo == request.auth.uid);
```

A lecturer can read a task **only** if it's assigned to them. This is checked by Firestore, not by the app. Even the DevTools attack above fails with `permission-denied`.

This has a consequence worth understanding: a lecturer's query **must** be narrowed, or the whole query is rejected:

```ts
where("assignedTo", "==", uid)   // required, not decoration
```

### The seven guarantees

1. A user can read their own profile
2. Only an admin can write `role`
3. A lecturer reads only their own tasks
4. HoD and admin read all tasks
5. Only a HoD creates tasks
6. A lecturer updates only `status`, `progressNote`, `declineReason` — on their own tasks
7. Only HoD/admin can list the users collection

Plus: lecturers can't move deadlines, change priority, reassign, or fake a reminder timestamp; HoDs can't change status; declining requires a written reason.

**All 33 of these are tested** — `npm run test:rules` runs them against a local Firestore emulator. That's strong evidence for a defence: you didn't just write rules, you proved they work.

---

# 8. Why "overdue" is calculated, not stored

`status` never holds the value `overdue`. Instead:

```
overdue  =  deadline < now  AND  status is incoming or ongoing
```

**Why does this matter?** If you stored it, you'd need a job running every midnight to flip tasks to overdue. That means more infrastructure, and the data is *wrong* whenever the job is late or fails.

Computing it at display time is always correct and costs nothing. One function — `isOverdue()` in [lib/tasks.ts](smart_task/lib/tasks.ts) — feeds the task lists, the dashboard counts, the notification bell *and* the reminder emails. They can never disagree with each other.

This is a genuine design decision, not a shortcut. Be ready to explain it.

---

# 9. Email reminders

**The constraint:** Firebase's free Spark plan doesn't allow scheduled Cloud Functions. Those need the paid Blaze plan.

**The solution:** put the schedule *outside* Firebase.

```
Cron service (Vercel Cron / cron-job.org)
        │  calls once a day at 06:00, with a secret
        ▼
/api/cron/reminders
        │
        ├─ find tasks where deadline ≤ now + 24h
        ├─ keep only status incoming/ongoing
        ├─ skip any reminded in the last 24h
        │
        ├─ look up the lecturer's email
        ├─ send via Resend
        └─ stamp lastReminderSentAt
```

Two details worth pointing out:

- **It's protected by `CRON_SECRET`.** Without it, anyone could hit the URL and spam your lecturers. No secret → `401`.
- **The 24-hour check makes it safe to re-run.** If the cron fires twice, or you test it manually, nobody gets duplicate emails. `lastReminderSentAt` is only stamped *after* a successful send, so a failure is retried next time rather than silently lost.

There's also `?dryRun=1`, which shows exactly which tasks qualify without sending anything — useful for demonstrating it live without spamming anyone.

### Why daily, and what that costs

`vercel.json` schedules `0 6 * * *` — **once a day at 06:00**, not hourly. That is forced
by the same kind of constraint as the Spark plan: Vercel's free Hobby plan permits only one
cron invocation per day.

Be precise about the consequence, because it is a fair question:

- **Nothing is ever missed.** The look-ahead window is 24 hours and the interval is 24
  hours, so consecutive runs cover a continuous stretch of time with no gap. Every open
  task gets at least one reminder before its deadline.
- **But the notice varies.** A lecturer gets somewhere between 0 and 24 hours' warning,
  depending where the deadline falls relative to 06:00 — not reliably a full day.
- An overdue task keeps qualifying, so it is reminded once a day until it is completed or
  declined.

On a paid plan the same route on an hourly schedule would tighten the notice to within an
hour, with no code change. The 24-hour guard already makes that safe.

### The email provider

Sending goes through **Resend**, called with a plain `fetch` POST in
[lib/email.ts](smart_task/lib/email.ts) rather than the npm package — one HTTP request, one
fewer dependency, and swapping provider means editing that file alone.

Two things to know before a live demo:

- **`RESEND_API_KEY` must be set** in `.env.local`. Without it the route refuses the run
  with a `500` rather than failing silently.
- **The sender address decides who can receive.** With the shared
  `onboarding@resend.dev` sender and no verified domain, Resend only delivers to the
  address the account was registered with. The seeded lecturer addresses
  (`lecturer1@uok.ac.rw` and similar) are fictional, so for a demo that actually shows an
  email arriving, point one account at a real inbox you control.

### The three emails the system sends

The cron job above covers deadlines. Two more go out the moment something happens,
through [/api/notify/task](smart_task/app/api/notify/task/route.ts):

| When | Who gets it | Subject |
|---|---|---|
| A HoD assigns (or reassigns) a task | the lecturer | *New task assigned: …* |
| A lecturer starts, completes or declines | the HoD who assigned it | *Completed: … — Aline Uwineza* |
| A deadline is within 24h, or has passed | the lecturer | *Due in 24 hours: …* |

**Why these need a server route.** Assigning a task is a direct browser-to-Firestore
write, so nothing server-side ever notices it — and with no Cloud Functions on the
Spark plan, there is no database trigger to hang an email on. The browser cannot send
the mail itself either, because that would mean shipping `RESEND_API_KEY` to the
client, where anyone could read it. So the page writes to Firestore and then asks this
route to do the emailing.

**What stops it being abused.** The route takes nothing but a task id. It verifies the
caller's ID token, re-reads the task with the Admin SDK, and derives the recipient and
the wording from the *stored* document — so a caller cannot use it to mail arbitrary
text to arbitrary people. It then checks the relationship: only a HoD may announce an
assignment, and a lecturer may only report progress on a task where
`assignedTo == their own uid`.

**Failures are soft on purpose.** By the time the email is attempted, the user's change
is already saved in Firestore. A missing API key or a bounced address therefore returns
`200` with `"sent": false` and is logged — never an error on a screen where the work in
fact succeeded.

---

# 10. In-app notifications

The 🔔 bell counts tasks that are **overdue** or **due within 24 hours**, for whoever is signed in — their own tasks if they're a lecturer, all tasks if they're a HoD.

Nothing is stored for this. It's the same `isOverdue()` / `isDueSoon()` functions applied to the live task subscription. Red badge if anything is overdue, amber if only due-soon.

---

# 11. Why some things go through a server

Almost everything is a direct Firestore write. Three exceptions:

**Creating an account** — `createUserWithEmailAndPassword()` in the browser signs the *current* user out and in as the new account. An admin creating a lecturer would lose their own session mid-click. So [/api/admin/users](smart_task/app/api/admin/users/route.ts) does it server-side with the Admin SDK — after verifying the caller's token and re-checking that they really are an admin.

**The reminder job** — it has to read *every* lecturer's tasks, which no signed-in user is permitted to do.

**The notification emails** — sending mail needs `RESEND_API_KEY`, and a key in the browser is a key anyone can read. See section 9.

Both use the **service account** key in `.env.local`. That key bypasses the security rules entirely, which is exactly why it must never reach the browser.

---

# 12. The one-paragraph version

> SmartTask is a Next.js web app where the browser talks to Cloud Firestore directly. Firebase Authentication proves who you are; a `users` document says what role you hold; and `firestore.rules` — running on Google's servers — enforces what each role may read and write, so the restrictions can't be bypassed by editing the client. Heads of Department create tasks, lecturers report progress on their own tasks only, and overdue status is derived from the deadline rather than stored, so it's always accurate without a nightly job. Because the free Spark plan forbids scheduled Cloud Functions, deadline reminders run through a secret-protected API route that an external cron service calls, with a 24-hour guard so re-running it never duplicates emails.

---

## Questions you should expect

| Question | Short answer |
|---|---|
| "Where is your backend?" | Firestore *is* the backend. Rules are the authorisation layer. Two API routes handle what can't be done client-side. |
| "How do you stop a lecturer seeing others' tasks?" | Rule 3 — and I can demo it failing in DevTools. |
| "Why no overdue status?" | Deriving it needs no scheduled job and can never go stale. |
| "Why not Cloud Functions for reminders?" | Spark plan doesn't allow scheduling. External cron + protected route achieves the same on free tier. |
| "How often do reminders run?" | Once daily at 06:00 — Vercel's free plan allows one cron run per day. No task is missed, but notice varies from 0 to 24 hours. Hourly needs only a schedule change. |
| "How do you know the rules work?" | 33 automated tests against the emulator — `npm run test:rules`. |
| "How does a lecturer know they were given a task?" | An email goes out the moment it is assigned, via `/api/notify/task` — the write itself cannot trigger one, because Spark has no Cloud Functions. |
| "Could someone abuse that route to send emails?" | It accepts only a task id, re-reads the task server-side, and checks the caller really is the HoD or the assigned lecturer. |
