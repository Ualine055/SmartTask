"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "./app-shell";
import { useAuth } from "./auth-provider";
import { Alert, Button, Card, Spinner } from "./ui";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { HOME_FOR_ROLE, ROLE_LABELS, type Role } from "@/lib/types";

/**
 * Client-side gate for a signed-in screen.
 *
 * This is a usability layer - it routes people to the screen that matches
 * their role and keeps them out of pages that would only show errors. It is
 * NOT the security boundary: firestore.rules re-checks every read and write,
 * so bypassing this component gains an attacker nothing but an empty page.
 */
export function Protected({
  roles,
  children,
}: {
  roles?: Role[];
  children: ReactNode;
}) {
  const { firebaseUser, profile, loading, profileMissing, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !isFirebaseConfigured) return;
    if (!firebaseUser) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, firebaseUser, router, pathname]);

  if (!isFirebaseConfigured) return <ConfigNotice />;
  if (loading) return <FullPage><Spinner label="Checking your account" /></FullPage>;
  if (!firebaseUser) return <FullPage><Spinner label="Redirecting to sign in" /></FullPage>;

  if (profileMissing || !profile) {
    return (
      <Notice title="Your account has no profile yet">
        <p className="text-sm text-muted">
          You are signed in as <strong>{firebaseUser.email}</strong>, but there is
          no matching record in the <code>users</code> collection. An administrator
          needs to create one before you can use SmartTask.
        </p>
        <Button className="mt-4" color="white" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Notice>
    );
  }

  if (!profile.isActive) {
    return (
      <Notice title="Account deactivated">
        <Alert tone="error">
          Your account has been deactivated by an administrator. Please contact the
          School of Computing and IT office.
        </Alert>
        <Button className="mt-4" color="white" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Notice>
    );
  }

  if (roles && !roles.includes(profile.role)) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="text-lg font-semibold text-ink">Not available for your role</h1>
          <p className="mt-2 text-sm text-muted">
            You are signed in as a {ROLE_LABELS[profile.role]}, which does not have
            access to this page.
          </p>
          <Link
            href={HOME_FOR_ROLE[profile.role]}
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Go to my home page
          </Link>
        </Card>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}

function FullPage({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center">{children}</div>;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FullPage>
      <Card className="mx-4 max-w-lg">
        <h1 className="mb-2 text-lg font-semibold text-ink">{title}</h1>
        {children}
      </Card>
    </FullPage>
  );
}

/** Shown instead of a cryptic Firebase crash when .env.local is not filled in. */
export function ConfigNotice() {
  return (
    <FullPage>
      <Card className="mx-4 max-w-xl">
        <h1 className="mb-2 text-lg font-semibold text-ink">Firebase is not configured</h1>
        <p className="text-sm text-muted">
          Copy <code>.env.local.example</code> to <code>.env.local</code>, fill in the
          values from your Firebase project (Project settings → Your apps → Web app),
          then restart the dev server. The README walks through it step by step.
        </p>
      </Card>
    </FullPage>
  );
}
