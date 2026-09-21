/**
 * Seeds demo accounts and tasks so every role and every state can be shown.
 *
 * Run from the smart_task folder:
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Safe to re-run: existing accounts are reused (their password is reset to the
 * one below) and the demo tasks are replaced rather than duplicated.
 *
 * Add --wipe to delete ALL tasks first, including ones created in the UI.
 */

import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const PASSWORD = "Password123!";
const DEPARTMENT = "Computer Science";
const SEED_TAG = "seed-demo"; // lets a re-run find and replace its own tasks

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// With the emulators running, no service account is needed.
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId =
  process.env.FIREBASE_PROJECT_ID ?? (usingEmulator ? "demo-smarttask" : undefined);

if (!projectId || (!usingEmulator && (!clientEmail || !privateKey))) {
  console.error(
    "Missing Admin SDK credentials.\n" +
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in\n" +
      ".env.local, then run:  node --env-file=.env.local scripts/seed.mjs\n\n" +
      "Or seed the local emulators instead:  npm run seed:emulator",
  );
  process.exit(1);
}

initializeApp(
  usingEmulator
    ? { projectId }
    : { credential: cert({ projectId, clientEmail, privateKey }), projectId },
);

if (usingEmulator) console.log("Seeding the local emulators.");

const auth = getAuth();
const db = getFirestore();

/**
 * The @uok.ac.rw addresses below are fictional, so nothing reaches a human
 * inbox during a demonstration. DEMO_LECTURER_EMAILS in .env.local is a comma
 * separated list of real inboxes, applied to lecturer1, lecturer2 and
 * lecturer3 in order; any left over keep their fictional address.
 */
const DEMO_EMAILS = (process.env.DEMO_LECTURER_EMAILS ?? "")
  .split(",")
  .map((address) => address.trim())
  .filter(Boolean);

const lecturerEmail = (index, fallback) => DEMO_EMAILS[index] || fallback;

const PEOPLE = [
  { key: "admin", fullName: "Alice Uwase", email: "admin@uok.ac.rw", role: "admin" },
  { key: "hod", fullName: "Dr. Eric Mugisha", email: "hod@uok.ac.rw", role: "hod" },
  {
    key: "lecturer1",
    fullName: "Jean Bosco Habimana",
    email: lecturerEmail(0, "lecturer1@uok.ac.rw"),
    role: "lecturer",
  },
  {
    key: "lecturer2",
    fullName: "Claudine Mukamana",
    email: lecturerEmail(1, "lecturer2@uok.ac.rw"),
    role: "lecturer",
  },
  {
    key: "lecturer3",
    fullName: "Patrick Nshimiyimana",
    email: lecturerEmail(2, "lecturer3@uok.ac.rw"),
    role: "lecturer",
  },
];

/** Creates the Auth user if missing, then writes the users/{uid} document. */
async function upsertPerson(person) {
  let record;
  try {
    record = await auth.getUserByEmail(person.email);
    await auth.updateUser(record.uid, {
      password: PASSWORD,
      displayName: person.fullName,
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    record = await auth.createUser({
      email: person.email,
      password: PASSWORD,
      displayName: person.fullName,
    });
  }

  await db.collection("users").doc(record.uid).set(
    {
      uid: record.uid,
      fullName: person.fullName,
      email: person.email,
      role: person.role,
      department: DEPARTMENT,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`  ${person.role.padEnd(8)} ${person.email}  (uid ${record.uid})`);
  return { ...person, uid: record.uid };
}

const hoursFromNow = (hours) =>
  Timestamp.fromDate(new Date(Date.now() + hours * 60 * 60 * 1000));

async function deleteWhere(field, value) {
  const snapshot = await db.collection("tasks").where(field, "==", value).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  if (snapshot.size) await batch.commit();
  return snapshot.size;
}

async function deleteAllTasks() {
  const snapshot = await db.collection("tasks").get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  if (snapshot.size) await batch.commit();
  return snapshot.size;
}

async function main() {
  console.log("\nCreating accounts (password for all: " + PASSWORD + ")\n");
  const people = {};
  for (const person of PEOPLE) {
    people[person.key] = await upsertPerson(person);
  }

  const hod = people.hod;
  const [l1, l2, l3] = [people.lecturer1, people.lecturer2, people.lecturer3];

  console.log("\nSeeding tasks");
  if (process.argv.includes("--wipe")) {
    console.log(`  removed ${await deleteAllTasks()} existing task(s) (--wipe)`);
  } else {
    const removed = await deleteWhere("seedTag", SEED_TAG);
    if (removed) console.log(`  replaced ${removed} previous demo task(s)`);
  }

  // Deliberately covers every state a marker will want to see: overdue,
  // due within 24 hours, in progress, completed and declined.
  const TASKS = [
    {
      to: l1,
      title: "Submit CS301 continuous assessment marks",
      description:
        "Upload the marked CAT scripts and the mark sheet to the departmental drive.",
      priority: "high",
      hours: -48, // overdue
      status: "incoming",
    },
    {
      to: l1,
      title: "Prepare the semester examination paper for IT205",
      description:
        "Draft paper plus the marking guide, ready for moderation by the exams office.",
      priority: "high",
      hours: 18, // due within 24h - the reminder job will pick this up
      status: "ongoing",
      progressNote: "Section A is drafted; the practical section still needs work.",
    },
    {
      to: l2,
      title: "Update the Data Structures course outline",
      description: "Align the outline with the revised curriculum approved last term.",
      priority: "medium",
      hours: 120,
      status: "ongoing",
      progressNote: "Waiting for the approved curriculum document from the registrar.",
    },
    {
      to: l2,
      title: "Supervise final-year project presentations",
      description: "Chair the Friday panel in Lab 3 and record the marks.",
      priority: "medium",
      hours: -6, // overdue
      status: "ongoing",
    },
    {
      to: l2,
      title: "Return marked assignments to students",
      description: "All IT102 assignments to be returned with written feedback.",
      priority: "low",
      hours: -240,
      status: "completed",
      progressNote: "All 58 assignments returned with feedback.",
      completed: true,
    },
    {
      to: l3,
      title: "Attend the curriculum review workshop",
      description: "Two-day workshop at the main campus; take notes for the department.",
      priority: "low",
      hours: 72,
      status: "cannot_complete",
      declineReason:
        "I am on approved study leave for the whole of that week and cannot attend.",
    },
    {
      to: l3,
      title: "Set up the networking lab for the practical exam",
      description: "Twelve workstations imaged and the switch configuration restored.",
      priority: "high",
      hours: 8, // due within 24h
      status: "incoming",
    },
    {
      to: l3,
      title: "Compile the departmental research output report",
      description: "List publications and conference papers for the academic year.",
      priority: "medium",
      hours: 336,
      status: "incoming",
    },
  ];

  const batch = db.batch();
  for (const task of TASKS) {
    const ref = db.collection("tasks").doc();
    batch.set(ref, {
      title: task.title,
      description: task.description,
      assignedTo: task.to.uid,
      assignedToName: task.to.fullName,
      assignedBy: hod.uid,
      assignedByName: hod.fullName,
      priority: task.priority,
      deadline: hoursFromNow(task.hours),
      status: task.status,
      progressNote: task.progressNote ?? "",
      declineReason: task.declineReason ?? "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: task.completed ? hoursFromNow(task.hours) : null,
      lastReminderSentAt: null,
      seedTag: SEED_TAG,
    });
  }
  await batch.commit();
  console.log(`  created ${TASKS.length} tasks`);

  console.log(`
Done. Sign in at http://localhost:3000/login

  Administrator      admin@uok.ac.rw
  Head of Department hod@uok.ac.rw
  Lecturers          ${PEOPLE.filter((p) => p.role === "lecturer").map((p) => p.email).join(", ")}

  Password for all:  ${PASSWORD}

Two tasks fall due within 24 hours and two are already overdue, so the bell icon
and the reminder job both have something to show.
`);
}

main().catch((error) => {
  console.error("\nSeeding failed:", error.message);
  process.exit(1);
});
