import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

import { ApiError, errorResponse, requireRole } from "@/lib/api-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ROLES, type Role } from "@/lib/types";

/**
 * POST /api/admin/users - admin-only account creation.
 *
 * Done server-side with the Admin SDK on purpose: calling
 * createUserWithEmailAndPassword() in the browser replaces the current session,
 * which would silently sign the admin out of their own dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(request, ["admin"]);

    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
      department?: string;
      role?: Role;
    };

    const fullName = body.fullName?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const department = body.department?.trim() ?? "";
    const password = body.password ?? "";
    const role = body.role ?? "lecturer";

    if (!fullName) throw new ApiError(400, "Full name is required.");
    if (!email) throw new ApiError(400, "Email address is required.");
    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters.");
    }
    if (!ROLES.includes(role)) throw new ApiError(400, "Unknown role.");

    let uid: string;
    try {
      const created = await adminAuth().createUser({
        email,
        password,
        displayName: fullName,
      });
      uid = created.uid;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        throw new ApiError(409, "An account with that email already exists.");
      }
      if (code === "auth/invalid-email") {
        throw new ApiError(400, "That email address is not valid.");
      }
      throw err;
    }

    try {
      await adminDb().collection("users").doc(uid).set({
        uid,
        fullName,
        email,
        role,
        department,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      // Don't leave an Auth account stranded without a profile document.
      await adminAuth().deleteUser(uid).catch(() => {});
      throw err;
    }

    return Response.json({ uid }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
