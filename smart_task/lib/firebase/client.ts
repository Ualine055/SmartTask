import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

/** Point the browser SDK at `firebase emulators:start` instead of a real project. */
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

/** True when .env.local has been filled in - lets the UI show a helpful hint. */
export const isFirebaseConfigured =
  useEmulator ||
  Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );

/**
 * Placeholders keep initializeApp()/getAuth() from throwing during `next build`
 * or before .env.local exists. Nothing can be read or written with them - the
 * UI checks isFirebaseConfigured and shows setup instructions instead.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "not-configured",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "not-configured",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    (useEmulator ? "demo-smarttask" : "not-configured"),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// getApps() guard keeps Fast Refresh from re-initialising the app in dev.
const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulator && isNewApp) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export default app;
