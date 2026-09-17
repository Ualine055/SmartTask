import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Admin SDK - server side only. It bypasses firestore.rules, so it is used
 * exclusively where a request cannot be made as the signed-in user:
 *   - the reminder cron job (scans every lecturer's tasks)
 *   - admin account creation (creating a user must not sign the admin out)
 * Every request that reaches it is authorised first (ID token or CRON_SECRET).
 */
const ADMIN_APP = "smarttask-admin";

/** Set by `firebase emulators:start`; means no service account is needed. */
function usingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function credentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel/`.env` store the PEM with literal \n sequences; turn them back into newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (see .env.local.example).",
    );
  }
  return { projectId, clientEmail, privateKey };
}

function adminApp(): App {
  const existing = getApps().find((a) => a.name === ADMIN_APP);
  if (existing) return existing;

  if (usingEmulator()) {
    // The emulator accepts any project id and ignores credentials entirely.
    const projectId =
      process.env.FIREBASE_PROJECT_ID ??
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
      "demo-smarttask";
    return initializeApp({ projectId }, ADMIN_APP);
  }

  const { projectId, clientEmail, privateKey } = credentials();
  return initializeApp(
    { credential: cert({ projectId, clientEmail, privateKey }), projectId },
    ADMIN_APP,
  );
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb() {
  return getFirestore(adminApp());
}

export function hasAdminCredentials() {
  if (usingEmulator()) return true;
  try {
    credentials();
    return true;
  } catch {
    return false;
  }
}
