"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";

import { AuthCard } from "@/components/auth-card";
import { useAuth } from "@/components/auth-provider";
import { ConfigNotice } from "@/components/protected";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { HOME_FOR_ROLE } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, profile, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next");

  // Already signed in? Send them straight to the home screen for their role.
  useEffect(() => {
    if (loading || !firebaseUser || !profile) return;
    router.replace(next || HOME_FOR_ROLE[profile.role]);
  }, [loading, firebaseUser, profile, next, router]);

  if (!isFirebaseConfigured) return <ConfigNotice />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // The effect above performs the role-based redirect once the profile loads.
    } catch (err) {
      setError(authErrorMessage(err, "Could not sign you in."));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Use your university email address."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Register as a lecturer
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

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

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
