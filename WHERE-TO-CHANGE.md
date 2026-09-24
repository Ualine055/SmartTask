# Where to change things — live edit map

For the defence. If an examiner asks for a change, this says which file and
which line, so nothing has to be hunted for while they watch.

Paths are relative to `smart_task/`. Line numbers drift as the file is edited —
the nearby search term in each row is what to trust.

---

## The trick that always works

Everything visible on screen is written somewhere as plain text. So when
something is pointed at, **search the project for the words that are on it**.

In VS Code: `Ctrl+Shift+F`, type the visible text, press Enter.

- Pointing at a button reading **Create account**? Search `Create account`.
- Pointing at **Sign in**? Search `Sign in`.
- A column header reading **Department**? Search `Department`.

This finds anything in seconds and never goes out of date, whatever this
document says. The tables below are faster when they apply; this works when
they don't.

For something with no words — a colour, a corner radius, a shadow — go
straight to `app/globals.css` or `components/ui.tsx`. Between them they hold
nearly every visual decision in the app.

## How the project is laid out

```
smart_task/
├── app/              one folder per URL; page.tsx is that screen
│   ├── login/        /login
│   ├── register/     /register
│   ├── dashboard/    /dashboard
│   ├── tasks/        /tasks, /tasks/new, /tasks/[id]
│   ├── my-tasks/     /my-tasks and /my-tasks/[id]
│   ├── admin/        /admin/users
│   ├── api/          server routes - no visuals here
│   ├── layout.tsx    wraps every page; sets the tab title
│   └── globals.css   COLOURS AND FONTS for the whole app
│
├── components/       pieces shared by several screens
│   ├── ui.tsx        THE DESIGN SYSTEM - button, input, card, alert
│   ├── app-shell.tsx header, navigation, footer
│   ├── badges.tsx    the coloured status/priority/role pills
│   ├── task-form.tsx the create/edit task form
│   └── task-row.tsx  one row in a task list
│
└── lib/              logic and data. No visuals - never edit for appearance
    ├── types.ts      roles, statuses, priorities, departments
    ├── tasks.ts      overdue and due-soon rules
    ├── email.ts      the email templates
    └── firebase/     database connection
```

Two rules that make this easy to reason about:

**Appearance lives in `app/globals.css` and `components/`. Never in `lib/`.**
If a change is about how something *looks*, `lib/` is the wrong folder.

**If the same style would be edited twice, it is the wrong file.** A button is
defined once in `ui.tsx` and used everywhere, so changing it there changes it
everywhere. Editing a colour on one page only means the shared component was
missed.

---

## Colours

Almost every colour comes from one of three places.

| Ask | File | Search for |
|---|---|---|
| The whole app's blue | `app/globals.css` 4-10 | `--color-brand-600` |
| Text, borders, background | `app/globals.css` 11-14 | `--color-ink` |
| Any button's colour | `components/ui.tsx` 18-23 | `BUTTON_VARIANTS` |
| Status badge colours | `components/badges.tsx` 9-14 | `STATUS_TONES` |
| Priority badge colours | `components/badges.tsx` 30-33 | `PRIORITY_TONES` |
| Role badge colours | `components/badges.tsx` 44-47 | `ROLE_TONES` |
| Colours inside emails | `lib/email.ts` 81-85 | `const ACCENT` |

**The one to remember:** changing `--color-brand-600` in `globals.css` re-themes
the entire application — buttons, links, the logo mark, badges, focus rings.
One line, everything moves together. That is the answer to "can you change the
colour scheme?"

## Buttons

`components/ui.tsx` 18-23. Four variants, one object:

```ts
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:   "bg-brand-600 text-white hover:bg-brand-700 …",
  secondary: "bg-white text-ink ring-1 ring-line …",
  danger:    "bg-red-600 text-white hover:bg-red-700 …",
  ghost:     "text-muted hover:bg-slate-100 …",
};
```

Every button in the app uses one of these. Shape, padding and radius are on the
line below, in the `Button` function: `rounded-lg px-4 py-2`. Change `rounded-lg`
to `rounded-full` for pill buttons, app-wide.

## Form fields

`components/ui.tsx` 47 — the `FIELD` constant. Every input, textarea and select
shares it, so one edit restyles every form.

## Header, navigation and footer

`components/app-shell.tsx`

| Ask | Line | Search for |
|---|---|---|
| Add or rename a menu item | 13-21 | `const NAV` |
| The name in the top left | 46 | `SmartTask` |
| Footer line | 158 | `School of Computing and IT` |
| Browser tab title | `app/layout.tsx` 13 | `title:` |

`NAV` is keyed by role, so adding a link for one role only is a one-line change
there — and worth saying out loud: the menu is per-role, but `firestore.rules`
is what actually enforces it.

## Wording on each screen

| Screen | File |
|---|---|
| Landing page | `app/page.tsx` |
| Sign in | `app/login/page.tsx` |
| Register | `app/register/page.tsx` |
| HoD dashboard | `app/dashboard/page.tsx` |
| All tasks (HoD) | `app/tasks/page.tsx` |
| Create a task | `app/tasks/new/page.tsx` + `components/task-form.tsx` |
| One task (HoD view) | `app/tasks/[id]/page.tsx` |
| My tasks (lecturer) | `app/my-tasks/page.tsx` |
| One task (lecturer) | `app/my-tasks/[id]/page.tsx` |
| Manage users | `app/admin/users/page.tsx` |

Page titles and subtitles are the `<PageHeader title=… description=…>` near the
top of each page.

## Lists and values

| Ask | File | Search for |
|---|---|---|
| Add or rename a programme | `lib/types.ts` 11 | `DEPARTMENTS` |
| Rename a status as shown | `lib/types.ts` | `STATUS_LABELS` |
| Rename a priority | `lib/types.ts` | `PRIORITY_LABELS` |
| Rename a role as shown | `lib/types.ts` | `ROLE_LABELS` |
| Where each role lands after login | `lib/types.ts` | `HOME_FOR_ROLE` |

Renaming a *label* is safe. Renaming the stored value underneath means existing
documents keep the old one, so say that if asked.

## Behaviour

| Ask | File | Search for |
|---|---|---|
| How long before a deadline counts as due soon | `lib/tasks.ts` 29 | `DUE_SOON_MS` |
| What makes a task overdue | `lib/tasks.ts` 24 | `isOverdue` |
| Who may read or write what | `firestore.rules` | `allow read` |
| Which tasks get a reminder | `app/api/cron/reminders/route.ts` 92-100 | `candidates` |
| Reminder schedule | `vercel.json` | `schedule` |
| Wording of each email | `lib/email.ts` | `assignedHtml` |

`DUE_SOON_MS` is one constant feeding the bell, the dashboard counts *and* the
reminder window — worth pointing at, because it is why they can never disagree.

---

## If asked to change something live

1. Find the file in this document rather than searching blind.
2. Say what the change affects before making it — "this is the only button
   definition, so it changes every button".
3. Save. The dev server hot-reloads; the browser updates without a restart.

Colour and label changes are the safest to accept. Anything touching
`firestore.rules` needs `firebase deploy --only firestore:rules` before it takes
effect, so say so rather than editing and expecting the browser to change.
