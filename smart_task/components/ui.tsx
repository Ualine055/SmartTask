"use client";

/**
 * EVERY BUTTON, INPUT, CARD AND ALERT IN THE APP IS DEFINED HERE.
 *
 * Each is written once and used on every screen, so changing it here changes
 * it everywhere. If the same edit would have to be made twice, this is the
 * file that was missed.
 *
 *   Button        four looks: primary (the default, blue), secondary (white),
 *                 danger (red, for delete and decline), ghost (plain text)
 *   Input etc.    every text box shares the FIELD line below
 *   Card          the white box with a border
 *   Alert         the coloured message strip
 *
 * The colours themselves are in app/globals.css.
 */

import { useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ button */

/**
 * Every button colour, by name. Each button on every screen says which one it
 * wants - <Button color="red"> - so a button's colour is changed at the button
 * itself, by swapping one word, not by hunting through this file.
 *
 * To change every blue button at once, edit the blue line here.
 * To change the blue itself, edit --color-brand-600 in app/globals.css.
 * To add a colour, add a line here and a word to ButtonColor above it.
 */
type ButtonColor = "blue" | "white" | "red" | "green" | "plain";

const BUTTON_COLORS: Record<ButtonColor, string> = {
  blue: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300",
  white: "bg-white text-ink ring-1 ring-line hover:bg-slate-50 disabled:text-muted",
  red: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  green: "bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300",
  plain: "text-muted hover:bg-slate-100 hover:text-ink",
};

export function Button({
  color = "blue",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { color?: ButtonColor }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
        "text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed",
        BUTTON_COLORS[color],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------- form fields */

const FIELD =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink " +
  "placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-muted";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx("mb-1.5 block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD, className)} {...props} />;
}

/**
 * A password box with a reveal toggle, so someone can check what they typed
 * before submitting. Whether the text is visible is state rather than a prop,
 * so every use starts hidden.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={cx(FIELD, "pr-11", className)}
        {...props}
      />
      <button
        type="button" // never submits the form it sits in
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-muted hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-4"
          aria-hidden
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          {visible ? <path d="m3 3 18 18" /> : null}
        </svg>
      </button>
    </div>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(FIELD, "pr-8", className)} {...props} />;
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------- containers */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- feedback */

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "bg-red-50 text-red-800 ring-red-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    info: "bg-brand-50 text-brand-700 ring-brand-200",
  } as const;
  return (
    <div className={cx("rounded-lg px-3 py-2 text-sm ring-1", tones[tone])} role="status">
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-line border-t-brand-600"
      />
      {label}…
    </div>
  );
}
