"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "./auth-provider";
import { NotificationBell } from "./notification-bell";
import { RoleBadge } from "./badges";
import { Button, cx } from "./ui";
import type { Role } from "@/lib/types";

const NAV: Record<Role, { href: string; label: string }[]> = {
  admin: [{ href: "/admin/users", label: "Users" }],
  hod: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/tasks", label: "All tasks" },
    { href: "/tasks/new", label: "New task" },
  ],
  lecturer: [{ href: "/my-tasks", label: "My tasks" }],
};

/**
 * Header + page frame for every signed-in screen. The signed-in user's name is
 * shown here, which satisfies "show the name on every page" in one place.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = profile ? NAV[profile.role] : [];

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              ST
            </span>
            <span className="hidden text-sm font-semibold text-ink sm:block">
              SmartTask
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-muted hover:bg-slate-100 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />

            {/* The signed-in name stays visible at every width, including phones. */}
            <div className="min-w-0 text-right">
              <p className="max-w-32 truncate text-sm font-medium leading-tight text-ink sm:max-w-none">
                {profile?.fullName ?? "…"}
              </p>
              <p className="hidden text-xs leading-tight text-muted sm:block">
                {profile?.department || profile?.email}
              </p>
            </div>
            {profile ? (
              <span className="hidden lg:block">
                <RoleBadge role={profile.role} />
              </span>
            ) : null}

            <Button
              variant="secondary"
              className="hidden sm:inline-flex"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Menu"
              className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink md:hidden"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="size-5"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-line bg-white px-4 py-3 md:hidden">
            <p className="pb-2 text-sm font-medium text-ink">
              {profile?.fullName}
              {profile ? (
                <span className="ml-2 align-middle">
                  <RoleBadge role={profile.role} />
                </span>
              ) : null}
            </p>
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cx(
                    "rounded-lg px-3 py-2 text-sm font-medium",
                    isActive(link.href)
                      ? "bg-brand-50 text-brand-700"
                      : "text-muted hover:bg-slate-100",
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => void signOut()}
              >
                Sign out
              </Button>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-line bg-white px-4 py-4 text-center text-xs text-muted">
        SmartTask · School of Computing and IT, University of Kigali
      </footer>
    </div>
  );
}
