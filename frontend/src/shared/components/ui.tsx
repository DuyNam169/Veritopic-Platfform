import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { AlertCircle, Loader2 } from "./icons";

export const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100/60 disabled:cursor-not-allowed disabled:opacity-60";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "warning" | "ghost";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
  warning: "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

export function Button({ variant = "secondary", busy = false, className = "", children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return <button {...props} disabled={disabled || busy} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}>
    {busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}
  </button>;
}

export function Panel({ children, className = "", ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section {...props} className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
    <div><p className="font-medium">{message}</p>{retry && <button onClick={retry} className="mt-1 font-semibold underline underline-offset-2">Thử lại</button>}</div>
  </div>;
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
    {icon && <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>}
    <h2 className="font-semibold text-slate-900">{title}</h2>
    {description && <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
  </div>;
}

export function PageSkeleton({ cards = 2 }: { cards?: number }) {
  return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: cards }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
}
