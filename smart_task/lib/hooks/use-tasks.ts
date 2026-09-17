"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";

import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase/client";
import type { Task } from "@/lib/types";

export interface TasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
}

/**
 * Each subscription result is tagged with the key it was loaded for. Comparing
 * that key against the current one tells us whether the data on hand belongs to
 * the current user - so `loading` is derived, and no effect has to call
 * setState synchronously to reset it.
 */
interface Keyed<T> {
  key: string;
  data: T;
  error: string | null;
}

/**
 * Live subscription to the tasks a signed-in user is allowed to see.
 *
 * A lecturer's query carries `where('assignedTo', '==', uid)`. That is not
 * cosmetic: firestore.rules only permits the read when the query itself is
 * narrowed that way, so an unfiltered query fails server-side.
 *
 * Sorting and overdue filtering happen in memory rather than in the query.
 * Departmental task volumes are small, and it keeps the project free of
 * composite indexes - one less thing to configure when marking the project.
 */
export function useVisibleTasks(): TasksResult {
  const { profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<Keyed<Task[]> | null>(null);

  const uid = profile?.uid ?? null;
  const role = profile?.role ?? null;
  const key = uid && role ? `${role}:${uid}` : "none";

  useEffect(() => {
    if (key === "none") return;
    const constraints: QueryConstraint[] =
      role === "lecturer" ? [where("assignedTo", "==", uid)] : [];

    return onSnapshot(
      query(collection(db, "tasks"), ...constraints),
      (snapshot) => {
        setState({
          key,
          data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Task),
          error: null,
        });
      },
      (err) => setState({ key, data: [], error: err.message }),
    );
  }, [key, uid, role]);

  const ready = key === "none" || state?.key === key;

  return {
    tasks: state?.key === key ? state.data : [],
    loading: authLoading || !ready,
    error: state?.key === key ? state.error : null,
  };
}

/** Live subscription to a single task document. */
export function useTask(taskId: string | undefined): {
  task: Task | null;
  loading: boolean;
  /** True when the document does not exist, or rules deny reading it. */
  notFound: boolean;
  error: string | null;
} {
  const { profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<Keyed<Task | null> | null>(null);

  const uid = profile?.uid ?? null;
  const key = taskId && uid ? `${uid}:${taskId}` : "none";

  useEffect(() => {
    if (key === "none" || !taskId) return;
    return onSnapshot(
      doc(db, "tasks", taskId),
      (snapshot) => {
        setState({
          key,
          data: snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as Task)
            : null,
          error: null,
        });
      },
      (err) => {
        // permission-denied is deliberately indistinguishable from "missing":
        // the rules refuse to confirm that someone else's task exists.
        setState({
          key,
          data: null,
          error: err.code === "permission-denied" ? null : err.message,
        });
      },
    );
  }, [key, taskId]);

  const current = state?.key === key ? state : null;
  const ready = key === "none" || current !== null;

  return {
    task: current?.data ?? null,
    loading: authLoading || !ready,
    notFound: ready && current !== null && current.data === null,
    error: current?.error ?? null,
  };
}
