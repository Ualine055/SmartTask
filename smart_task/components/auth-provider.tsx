"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db, isFirebaseConfigured } from "@/lib/firebase/client";
import type { AppUser, Role } from "@/lib/types";

interface AuthState {
  /** Raw Firebase credential, or null when signed out. */
  firebaseUser: FirebaseUser | null;
  /** The users/{uid} document - the source of truth for role and status. */
  profile: AppUser | null;
  /** True until both the credential and the profile have been resolved. */
  loading: boolean;
  /** Signed in, but users/{uid} does not exist yet (or could not be read). */
  profileMissing: boolean;
  role: Role | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** What the profile subscription has resolved, and for whom. */
interface ProfileState {
  uid: string;
  profile: AppUser | null;
  missing: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // `undefined` means "Firebase has not reported yet"; null means signed out.
  // Starting at null when Firebase is unconfigured avoids an endless spinner.
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(
    isFirebaseConfigured ? undefined : null,
  );
  const [profileState, setProfileState] = useState<ProfileState | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, setFirebaseUser);
  }, []);

  const uid = firebaseUser?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    // A live subscription, so an admin changing someone's role or deactivating
    // them takes effect in that person's open tab immediately.
    return onSnapshot(
      doc(db, "users", uid),
      (snapshot) => {
        setProfileState(
          snapshot.exists()
            ? {
                uid,
                profile: { ...snapshot.data(), uid: snapshot.id } as AppUser,
                missing: false,
              }
            : { uid, profile: null, missing: true },
        );
      },
      // A read failure here means the document is unreadable, which the app
      // treats the same way as missing: no role, no access.
      () => setProfileState({ uid, profile: null, missing: true }),
    );
  }, [uid]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthState>(() => {
    // Derived rather than stored, so no effect ever has to call setLoading().
    const resolved = uid !== null && profileState?.uid === uid;
    const profile = resolved ? profileState.profile : null;

    return {
      firebaseUser: firebaseUser ?? null,
      profile,
      loading: firebaseUser === undefined || (uid !== null && !resolved),
      profileMissing: resolved ? profileState.missing : false,
      role: profile?.role ?? null,
      signOut,
    };
  }, [firebaseUser, uid, profileState, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
