"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";

import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase/client";
import type { AppUser } from "@/lib/types";

export interface UsersResult {
  users: AppUser[];
  loading: boolean;
  error: string | null;
}

/**
 * Live list of every user account, sorted by name.
 *
 * Only admin and hod can run this: firestore.rules denies `list` on the users
 * collection to everyone else, so a lecturer calling it gets permission-denied
 * from the server, not just a hidden menu item.
 */
export function useUsers(): UsersResult {
  const { profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<{
    key: string;
    users: AppUser[];
    error: string | null;
  } | null>(null);

  const role = profile?.role ?? null;
  // Lecturers are not allowed to list users, so they subscribe to nothing.
  const key = role === "admin" || role === "hod" ? `${role}:${profile?.uid}` : "none";

  useEffect(() => {
    if (key === "none") return;
    return onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        const users = snapshot.docs.map(
          (d) => ({ ...d.data(), uid: d.id }) as AppUser,
        );
        users.sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
        setState({ key, users, error: null });
      },
      (err) => setState({ key, users: [], error: err.message }),
    );
  }, [key]);

  const current = state?.key === key ? state : null;
  const ready = key === "none" || current !== null;

  return {
    users: current?.users ?? [],
    loading: authLoading || !ready,
    error: current?.error ?? null,
  };
}

/** Active lecturers only - the people a HoD can assign work to. */
export function useAssignableLecturers(): UsersResult {
  const { users, loading, error } = useUsers();
  const assignable = useMemo(
    () => users.filter((u) => u.role === "lecturer" && u.isActive),
    [users],
  );
  return { users: assignable, loading, error };
}
