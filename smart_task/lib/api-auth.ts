import type { NextRequest } from "next/server";

import { adminAuth, adminDb } from "./firebase/admin";
import type { Role } from "./types";

export interface Caller {
  uid: string;
  email: string | null;
  role: Role;
  fullName: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Verifies the `Authorization: Bearer <Firebase ID token>` header and resolves
 * the caller's role from Firestore.
 *
 * The role is read from the users collection rather than trusted from the
 * request body - a client can send any JSON it likes, but it cannot forge a
 * signed ID token, and it cannot edit its own role document (firestore.rules).
 */
export async function requireRole(
  request: NextRequest,
  allowed: Role[],
): Promise<Caller> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "Missing authentication token.");

  let uid: string;
  let email: string | null;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch {
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  const snapshot = await adminDb().collection("users").doc(uid).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) throw new ApiError(403, "No user profile found.");
  if (data.isActive !== true) throw new ApiError(403, "This account is deactivated.");
  if (!allowed.includes(data.role as Role)) {
    throw new ApiError(403, "You do not have permission to do that.");
  }

  return { uid, email, role: data.role as Role, fullName: data.fullName ?? "" };
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  console.error("[api]", error);
  return Response.json({ error: message }, { status: 500 });
}
