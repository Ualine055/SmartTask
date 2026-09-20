/**
 * Security rules tests - run against the Firestore emulator.
 *
 *   npm run test:rules
 *
 * Each numbered test maps to one of the seven guarantees listed in the project
 * brief, plus the traps that a UI-only check would miss: a lecturer editing a
 * deadline, a HoD editing a status, a registration granting itself a role.
 */

import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "smarttask-rules-test";

const ADMIN = "uid-admin";
const HOD = "uid-hod";
const LECTURER = "uid-lecturer";
const OTHER_LECTURER = "uid-other-lecturer";
const INACTIVE = "uid-inactive";

const TASK_MINE = "task-mine";
const TASK_THEIRS = "task-theirs";

let testEnv;

/** A complete task document, so updates only ever change what a test intends. */
function taskDoc(overrides = {}) {
  return {
    title: "Submit CS301 marks",
    description: "Upload the mark sheet.",
    assignedTo: LECTURER,
    assignedToName: "Lecturer One",
    assignedBy: HOD,
    assignedByName: "Head of Department",
    priority: "high",
    deadline: new Date("2030-01-01T09:00:00Z"),
    status: "incoming",
    progressNote: "",
    declineReason: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    lastReminderSentAt: null,
    ...overrides,
  };
}

function userDoc(uid, role, isActive = true) {
  return {
    uid,
    fullName: `User ${uid}`,
    email: `${uid}@uok.ac.rw`,
    role,
    department: "Computer Science",
    isActive,
    createdAt: new Date(),
  };
}

/** Signed-in context; the token email matters for the registration rule. */
function as(uid) {
  return testEnv
    .authenticatedContext(uid, { email: `${uid}@uok.ac.rw` })
    .firestore();
}

before(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [hostname, port] = host.split(":");

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
      host: hostname,
      port: Number(port),
    },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`users/${ADMIN}`).set(userDoc(ADMIN, "admin"));
    await db.doc(`users/${HOD}`).set(userDoc(HOD, "hod"));
    await db.doc(`users/${LECTURER}`).set(userDoc(LECTURER, "lecturer"));
    await db.doc(`users/${OTHER_LECTURER}`).set(userDoc(OTHER_LECTURER, "lecturer"));
    await db.doc(`users/${INACTIVE}`).set(userDoc(INACTIVE, "lecturer", false));
    await db.doc(`tasks/${TASK_MINE}`).set(taskDoc());
    await db.doc(`tasks/${TASK_THEIRS}`).set(
      taskDoc({ assignedTo: OTHER_LECTURER, assignedToName: "Lecturer Two" }),
    );
  });
});

after(async () => {
  await testEnv?.cleanup();
});

describe("users collection", () => {
  it("1. a user can read their own document", async () => {
    await assertSucceeds(as(LECTURER).doc(`users/${LECTURER}`).get());
  });

  it("1b. a lecturer cannot read someone else's user document", async () => {
    await assertFails(as(LECTURER).doc(`users/${OTHER_LECTURER}`).get());
  });

  it("2. only an admin can write the role field", async () => {
    await assertSucceeds(as(ADMIN).doc(`users/${LECTURER}`).update({ role: "hod" }));
    // put it back so later tests still see a lecturer
    await assertSucceeds(
      as(ADMIN).doc(`users/${LECTURER}`).update({ role: "lecturer" }),
    );
  });

  it("2b. a lecturer cannot promote themselves", async () => {
    await assertFails(as(LECTURER).doc(`users/${LECTURER}`).update({ role: "hod" }));
  });

  it("2c. a HoD cannot change anyone's role", async () => {
    await assertFails(as(HOD).doc(`users/${LECTURER}`).update({ role: "admin" }));
    await assertFails(as(HOD).doc(`users/${HOD}`).update({ role: "admin" }));
  });

  it("2d. a user may edit their own name", async () => {
    await assertSucceeds(
      as(LECTURER).doc(`users/${LECTURER}`).update({ fullName: "New Name" }),
    );
  });

  it("2e. a deactivated user cannot reactivate themselves", async () => {
    // The write that matters: isActive actually changing value. (Writing the
    // value it already holds is a no-op that Firestore's diff() ignores, so it
    // is neither allowed nor a way to gain anything.)
    await assertFails(
      as(INACTIVE).doc(`users/${INACTIVE}`).update({ isActive: true }),
    );
  });

  it("2f. a lecturer cannot deactivate someone else", async () => {
    await assertFails(
      as(LECTURER).doc(`users/${OTHER_LECTURER}`).update({ isActive: false }),
    );
  });

  it("2g. an admin can deactivate and reactivate an account", async () => {
    await assertSucceeds(
      as(ADMIN).doc(`users/${OTHER_LECTURER}`).update({ isActive: false }),
    );
    await assertSucceeds(
      as(ADMIN).doc(`users/${OTHER_LECTURER}`).update({ isActive: true }),
    );
  });

  it("7. a lecturer cannot list the users collection", async () => {
    await assertFails(as(LECTURER).collection("users").get());
  });

  it("7b. a HoD and an admin can list the users collection", async () => {
    await assertSucceeds(as(HOD).collection("users").get());
    await assertSucceeds(as(ADMIN).collection("users").get());
  });

  it("registration can only ever create a lecturer", async () => {
    const newUid = "uid-new-signup";
    await assertFails(
      as(newUid).doc(`users/${newUid}`).set(userDoc(newUid, "hod")),
    );
    await assertFails(
      as(newUid).doc(`users/${newUid}`).set(userDoc(newUid, "admin")),
    );
    await assertSucceeds(
      as(newUid).doc(`users/${newUid}`).set(userDoc(newUid, "lecturer")),
    );
  });

  it("nobody can create a user document for someone else", async () => {
    await assertFails(
      as(LECTURER).doc("users/uid-someone-else").set(userDoc("uid-someone-else", "lecturer")),
    );
  });
});

describe("tasks collection", () => {
  it("3. a lecturer can read a task assigned to them", async () => {
    await assertSucceeds(as(LECTURER).doc(`tasks/${TASK_MINE}`).get());
  });

  it("3b. a lecturer cannot read another lecturer's task", async () => {
    await assertFails(as(LECTURER).doc(`tasks/${TASK_THEIRS}`).get());
  });

  it("3c. a lecturer cannot query tasks without filtering to their own uid", async () => {
    await assertFails(as(LECTURER).collection("tasks").get());
  });

  it("3d. a lecturer's filtered query is allowed", async () => {
    const snapshot = await assertSucceeds(
      as(LECTURER).collection("tasks").where("assignedTo", "==", LECTURER).get(),
    );
    assert.equal(snapshot.size, 1);
  });

  it("3e. a lecturer cannot query for someone else's tasks", async () => {
    await assertFails(
      as(LECTURER).collection("tasks").where("assignedTo", "==", OTHER_LECTURER).get(),
    );
  });

  it("4. a HoD and an admin can read every task", async () => {
    await assertSucceeds(as(HOD).collection("tasks").get());
    await assertSucceeds(as(ADMIN).collection("tasks").get());
  });

  it("5. only a HoD can create a task", async () => {
    await assertSucceeds(as(HOD).collection("tasks").add(taskDoc()));
    await assertFails(as(LECTURER).collection("tasks").add(taskDoc()));
    await assertFails(as(ADMIN).collection("tasks").add(taskDoc()));
  });

  it("5b. a task cannot be created already completed", async () => {
    await assertFails(
      as(HOD).collection("tasks").add(taskDoc({ status: "completed" })),
    );
  });

  it("5c. a HoD cannot create a task in another HoD's name", async () => {
    await assertFails(
      as(HOD).collection("tasks").add(taskDoc({ assignedBy: "uid-someone-else" })),
    );
  });

  it("6. a lecturer can update status and progressNote on their own task", async () => {
    await assertSucceeds(
      as(LECTURER).doc(`tasks/${TASK_MINE}`).update({
        status: "ongoing",
        progressNote: "Halfway through.",
        updatedAt: new Date(),
      }),
    );
  });

  it("6b. a lecturer cannot update another lecturer's task", async () => {
    await assertFails(
      as(LECTURER).doc(`tasks/${TASK_THEIRS}`).update({ status: "completed" }),
    );
  });

  it("6c. a lecturer cannot move their own deadline", async () => {
    await assertFails(
      as(LECTURER).doc(`tasks/${TASK_MINE}`).update({
        deadline: new Date("2031-01-01T09:00:00Z"),
      }),
    );
  });

  it("6d. a lecturer cannot change priority or reassign the task", async () => {
    await assertFails(
      as(LECTURER).doc(`tasks/${TASK_MINE}`).update({ priority: "low" }),
    );
    await assertFails(
      as(LECTURER).doc(`tasks/${TASK_MINE}`).update({ assignedTo: OTHER_LECTURER }),
    );
  });

  it("6e. a lecturer cannot fake a reminder timestamp", async () => {
    await assertFails(
      as(LECTURER).doc(`tasks/${TASK_MINE}`).update({ lastReminderSentAt: new Date() }),
    );
  });

  it("6f. declining requires a reason", async () => {
    await assertFails(
      as(LECTURER).doc(`tasks/${TASK_MINE}`).update({
        status: "cannot_complete",
        declineReason: "   ",
        updatedAt: new Date(),
      }),
    );
    await assertSucceeds(
      as(LECTURER).doc(`tasks/${TASK_MINE}`).update({
        status: "cannot_complete",
        declineReason: "I am on approved study leave that week.",
        updatedAt: new Date(),
      }),
    );
  });

  it("6g. a HoD may edit a task but may not change its status", async () => {
    await assertSucceeds(
      as(HOD).doc(`tasks/${TASK_MINE}`).update({
        title: "Submit CS301 marks (revised)",
        deadline: new Date("2030-02-01T09:00:00Z"),
        updatedAt: new Date(),
      }),
    );
    await assertFails(
      as(HOD).doc(`tasks/${TASK_MINE}`).update({ status: "completed" }),
    );
  });

  it("a HoD can delete a task; a lecturer cannot", async () => {
    await assertFails(as(LECTURER).doc(`tasks/${TASK_MINE}`).delete());
    await assertSucceeds(as(HOD).doc(`tasks/${TASK_THEIRS}`).delete());
  });
});

describe("deactivated and anonymous access", () => {
  it("a deactivated lecturer can still read their own profile", async () => {
    await assertSucceeds(as(INACTIVE).doc(`users/${INACTIVE}`).get());
  });

  it("a deactivated lecturer loses access to tasks", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("tasks/task-inactive").set(taskDoc({ assignedTo: INACTIVE }));
    });
    await assertFails(as(INACTIVE).doc("tasks/task-inactive").get());
    await assertFails(
      as(INACTIVE).collection("tasks").where("assignedTo", "==", INACTIVE).get(),
    );
  });

  it("a signed-out visitor can read nothing", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(anon.doc(`users/${LECTURER}`).get());
    await assertFails(anon.doc(`tasks/${TASK_MINE}`).get());
    await assertFails(anon.collection("tasks").get());
  });
});
