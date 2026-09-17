import type { ReactNode } from "react";

/** Centred card used by the signed-out screens (/login and /register). */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-600 font-bold text-white">
            ST
          </span>
          <div>
            <p className="text-lg font-semibold leading-tight text-ink">SmartTask</p>
            <p className="text-xs leading-tight text-muted">
              School of Computing and IT, University of Kigali
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
        </div>

        <p className="mt-4 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}
