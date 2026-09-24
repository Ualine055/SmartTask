"use client";

import { useMemo, useState, type FormEvent } from "react";
import { doc, updateDoc } from "firebase/firestore";

import { useAuth } from "@/components/auth-provider";
import { RoleBadge } from "@/components/badges";
import { Protected } from "@/components/protected";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  cx,
} from "@/components/ui";
import { auth, db } from "@/lib/firebase/client";
import { useUsers } from "@/lib/hooks/use-users";
import { authErrorMessage } from "@/lib/auth-errors";
import { formatDateTime } from "@/lib/tasks";
import { DEPARTMENTS, ROLES, ROLE_LABELS, type AppUser, type Role } from "@/lib/types";

export default function AdminUsersPage() {
  return (
    <Protected roles={["admin"]}>
      <AdminUsers />
    </Protected>
  );
}

function AdminUsers() {
  const { profile } = useAuth();
  const { users, loading, error } = useUsers();
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(needle) ||
        u.email?.toLowerCase().includes(needle) ||
        u.department?.toLowerCase().includes(needle),
    );
  }, [users, search]);

  async function changeRole(user: AppUser, role: Role) {
    if (role === user.role) return;
    setRowError(null);
    setBusyUid(user.uid);
    try {
      await updateDoc(doc(db, "users", user.uid), { role });
      setNotice(`${user.fullName} is now ${ROLE_LABELS[role]}.`);
    } catch (err) {
      setRowError(authErrorMessage(err, "Could not change that role."));
    } finally {
      setBusyUid(null);
    }
  }

  async function toggleActive(user: AppUser) {
    setRowError(null);
    setBusyUid(user.uid);
    try {
      await updateDoc(doc(db, "users", user.uid), { isActive: !user.isActive });
      setNotice(
        `${user.fullName} has been ${user.isActive ? "deactivated" : "reactivated"}.`,
      );
    } catch (err) {
      setRowError(authErrorMessage(err, "Could not update that account."));
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <>
      <PageHeader
        title="User accounts"
        description="Assign roles and control who can sign in."
        action={
          <Button color="blue" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Close" : "Add user"}
          </Button>
        }
      />

      {showCreate ? (
        <CreateUserForm
          onCreated={(name) => {
            setShowCreate(false);
            setNotice(`Account created for ${name}.`);
          }}
        />
      ) : null}

      <div className="space-y-3">
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {rowError ? <Alert tone="error">{rowError}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>

      <div className="mt-4">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or department"
          className="sm:max-w-sm"
          aria-label="Search users"
        />
      </div>

      {loading ? (
        <Spinner label="Loading users" />
      ) : filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={users.length === 0 ? "No user accounts yet" : "No matching users"}
            description={
              users.length === 0
                ? "Create the first account with the Add user button."
                : "Try a different search term."
            }
          />
        </div>
      ) : (
        <Card className="mt-4 overflow-hidden p-0">
          {/* Table on desktop, stacked cards on phones. */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((user) => {
                const isSelf = user.uid === profile?.uid;
                return (
                  <tr key={user.uid} className={cx(!user.isActive && "bg-slate-50/60")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">
                        {user.fullName}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-muted">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{user.department || "—"}</td>
                    <td className="px-4 py-3">
                      <Select
                        aria-label={`Role for ${user.fullName}`}
                        value={user.role}
                        disabled={isSelf || busyUid === user.uid}
                        onChange={(e) => void changeRole(user, e.target.value as Role)}
                        className="w-44"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <ActiveDot isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        color={user.isActive ? "white" : "blue"}
                        disabled={isSelf || busyUid === user.uid}
                        onClick={() => void toggleActive(user)}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="divide-y divide-line md:hidden">
            {filtered.map((user) => {
              const isSelf = user.uid === profile?.uid;
              return (
                <li key={user.uid} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {user.fullName}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-muted">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                      <p className="truncate text-xs text-muted">{user.department}</p>
                    </div>
                    <RoleBadge role={user.role} />
                  </div>
                  <ActiveDot isActive={user.isActive} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label={`Role for ${user.fullName}`}
                      value={user.role}
                      disabled={isSelf || busyUid === user.uid}
                      onChange={(e) => void changeRole(user, e.target.value as Role)}
                      className="w-40"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      color={user.isActive ? "white" : "blue"}
                      disabled={isSelf || busyUid === user.uid}
                      onClick={() => void toggleActive(user)}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted">
        You cannot change your own role or deactivate yourself — that guard stops an
        administrator from locking every admin out of the system.
      </p>
    </>
  );
}

function ActiveDot({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        aria-hidden
        className={cx("size-2 rounded-full", isActive ? "bg-emerald-500" : "bg-slate-400")}
      />
      <span className={isActive ? "text-emerald-700" : "text-muted"}>
        {isActive ? "Active" : "Deactivated"}
      </span>
    </span>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (name: string) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("lecturer");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The API route verifies this ID token and re-checks the admin role
      // server-side before touching Firebase Auth.
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ fullName, email, department, password, role }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create the account.");
      }
      onCreated(fullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-base font-semibold text-ink">Add a user account</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="new-name">
            <Input
              id="new-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label="Email address" htmlFor="new-email">
            <Input
              id="new-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Department" htmlFor="new-dept">
            <Select
              id="new-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role" htmlFor="new-role">
            <Select
              id="new-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Temporary password"
          htmlFor="new-password"
          hint="At least 6 characters. Ask the user to change it after their first sign-in."
        >
          <Input
            id="new-password"
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button color="blue" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
