import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  solid: "bg-fg text-bg",
  quiet: "border border-line bg-subtle text-fg",
  danger: "border border-line bg-bg text-crimson",
  ghost: "bg-transparent text-muted",
} as const;

export function Button({
  variant = "quiet",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type={type}
      className={`focus-ring tap inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export const fieldClass =
  "focus-ring w-full rounded-sm border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none placeholder:text-faint";

export const labelClass = "mb-1.5 block text-xs font-medium tracking-wide text-muted";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-elevated p-4 md:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow && <p className="text-xs font-medium tracking-[0.16em] text-crimson uppercase">{eyebrow}</p>}
            {title && <h2 className="font-display text-2xl leading-tight font-medium text-fg">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SpendDialog({
  eyebrow = "Owner approval",
  open,
  title,
  cost,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  cost: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/80 p-4 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="spend-title"
        className="w-full max-w-md rounded-lg border border-line bg-elevated p-5"
      >
        <p className="text-xs font-medium tracking-[0.16em] text-crimson uppercase">{eyebrow}</p>
        <h3 id="spend-title" className="mt-2 font-display text-3xl leading-none font-medium">
          {title}
        </h3>
        <p className="mt-4 font-mono text-2xl text-fg tabular-nums">{cost}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </Button>
          <Button variant="solid" onClick={onConfirm} disabled={busy}>
            {busy ? "Sending…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Notice({ text, onClose }: { text: string | null; onClose: () => void }) {
  if (!text) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line bg-subtle px-4 py-3 text-sm text-fg">
      <p>{text}</p>
      <button type="button" className="focus-ring shrink-0 text-muted" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
