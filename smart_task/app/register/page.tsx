"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { AuthCard } from "@/components/auth-card";
import { useAuth } from "@/components/auth-provider";
import { ConfigNotice } from "@/components/protected";
import { Alert, Button, Field, Input, PasswordInput } from "@/components/ui";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { DEPARTMENTS, HOME_FOR_ROLE } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const { firebaseUser, profile, loading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !firebaseUser || !profile) return;
    router.replace(HOME_FOR_ROLE[profile.role]);
  }, [loading, firebaseUser, profile, router]);

  if (!isFirebaseConfigured) return <ConfigNotice />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await updateProfile(credential.user, { displayName: fullName.trim() });

      // Note what is hard-coded here: role is always 'lecturer'. The form never
      // offers a choice, and firestore.rules rejects any other value on create,
      // so an account cannot grant itself privileges. Only an admin can promote.
      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        fullName: fullName.trim(),
        email: credential.user.email,
        role: "lecturer",
        department,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      router.replace("/my-tasks");
    } catch (err) {
      setError(authErrorMessage(err, "Could not create your account."));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create a lecturer account"
      subtitle="New accounts are always created as lecturers. An administrator can change your role later."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="Full name" htmlFor="fullName">
          <Input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jean Bosco Habimana"
          />
        </Field>

        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@uok.ac.rw"
          />
        </Field>

        <Field label="Department" htmlFor="department">
          <select
            id="department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 pr-8 text-sm text-ink"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" hint="At least 6 characters">
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>

        <Button color="blue" type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
