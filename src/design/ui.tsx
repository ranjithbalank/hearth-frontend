import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

import { ErrorState } from "./ErrorState";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[30%] bg-gradient-primary shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M5 21V11c0-3.9 3.1-7 7-7s7 3.1 7 7v10" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 21v-6" stroke="#93C5FD" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9 21h6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Card({
  children,
  className = "",
  interactive = false,
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  /** Clickable cards only — adds hover lift/shadow as an affordance. */
  interactive?: boolean;
  /** Thin gradient rule along the top edge, for one flagship card per screen. */
  accent?: boolean;
}) {
  return (
    <div className={clsx(interactive ? "card-interactive" : "card", accent && "card-accent", "p-5", className)}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  delta,
  deltaLabel,
  icon,
  delayMs,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "dark";
  /** percentage change vs a comparison period — renders an arrow pill */
  delta?: number;
  deltaLabel?: string;
  /** small icon rendered in a chip, top-right */
  icon?: ReactNode;
  /** stagger multiple Stats in a row: delayMs={i * 60} */
  delayMs?: number;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-card p-5 animate-fade-in-up",
        dark ? "bg-gradient-ink text-white shadow-md" : "card",
      )}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {dark && (
        <div
          className="pointer-events-none absolute -right-6 -top-10 w-32 h-32 rounded-full bg-pine-400/20 blur-2xl"
          aria-hidden
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className={`stat-num text-3xl ${dark ? "text-white" : ""}`}>{value}</div>
          {delta !== undefined && (
            <span
              className={clsx(
                "pill text-[11px] gap-0.5",
                delta > 0
                  ? dark ? "bg-white/15 text-white" : "bg-success-50 text-success"
                  : delta < 0
                    ? dark ? "bg-white/15 text-white" : "bg-clay-50 text-clay"
                    : dark ? "bg-white/10 text-white/70" : "bg-hairline text-muted",
              )}
            >
              {delta > 0 ? <ArrowUpRight size={11} /> : delta < 0 ? <ArrowDownRight size={11} /> : <Minus size={11} />}
              {Math.abs(delta)}%{deltaLabel && ` ${deltaLabel}`}
            </span>
          )}
        </div>
        {icon && (
          <span
            className={clsx(
              "shrink-0 grid place-items-center w-9 h-9 rounded-xl",
              dark ? "bg-white/20 text-white ring-1 ring-inset ring-white/10" : "bg-pine-50 text-pine",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className={`relative text-xs mt-1 ${dark ? "text-white/60" : "text-muted"}`}>{label}</div>
      {sub && <div className={`relative text-xs mt-2 ${dark ? "text-white/60" : "text-body"}`}>{sub}</div>}
    </div>
  );
}

/** Labelled form field wrapper — standardises label, required marker,
 *  hint and inline error across forms. */
export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted mb-1">
        {label}
        {required && <span className="text-clay ml-0.5">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-[11px] text-muted mt-1">{hint}</span>}
      {error && <span className="block text-[11px] text-clay mt-1 animate-fade-in">{error}</span>}
    </label>
  );
}

/** Icon-only button with a mandatory accessible label. */
export function IconButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "p-2 rounded-lg text-body transition-all duration-150 hover:bg-hairline/60 hover:text-ink active:scale-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

const TONES: Record<string, string> = {
  pine: "bg-pine-50 text-pine",
  clay: "bg-clay-50 text-clay",
  amber: "bg-amber-50 text-amber-600",
  info: "bg-info-50 text-info",
  muted: "bg-hairline text-muted",
  success: "bg-success-50 text-success",
  gold: "bg-gold-50 text-gold-700",
};

const DOTS: Record<string, string> = {
  pine: "bg-pine",
  clay: "bg-clay",
  amber: "bg-amber",
  info: "bg-info",
  muted: "bg-muted",
  success: "bg-success",
  gold: "bg-gold",
};

export function Badge({
  children,
  tone = "muted",
  dot = false,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  /** small solid dot before the label — handy for status without a full pill background */
  dot?: boolean;
}) {
  return (
    <span className={`pill ${TONES[tone] ?? TONES.muted}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${DOTS[tone] ?? DOTS.muted}`} aria-hidden />}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** small icon chip to the left of the title */
  icon?: ReactNode;
  /** tiny uppercase label above the title, e.g. a section name */
  eyebrow?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-6 gap-4 animate-fade-in-down">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="hidden sm:grid place-items-center w-11 h-11 rounded-2xl bg-gradient-primary text-white shrink-0 shadow-sm">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="text-xs font-bold uppercase tracking-widest text-pine mb-1">{eyebrow}</div>}
          <h1 className="font-display text-3xl font-semibold text-ink tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-4 w-80 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
    </div>
  );
}

/** Loading gate used by every screen (`if (isLoading || !data) return <Spinner/>`).
 *  Screens never check isError, so when a GET fails they'd sit on this forever —
 *  instead, once nothing is fetching and an active query has errored, render a
 *  branded ErrorState with a retry that refetches just the failed queries. */
export function Spinner() {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const failed =
    fetching === 0 &&
    qc.getQueryCache().findAll({ type: "active", predicate: (q) => q.state.status === "error" })
      .length > 0;
  if (failed) {
    return (
      <ErrorState
        onRetry={() =>
          qc.refetchQueries({ type: "active", predicate: (q) => q.state.status === "error" })
        }
      />
    );
  }
  return <PageSkeleton />;
}

function DefaultEmptyIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M6 6h12l2 7v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
    </svg>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  /** defaults to a bundled empty-tray glyph — pass any icon (e.g. lucide) to override */
  icon?: ReactNode;
  /** optional CTA rendered under the copy, e.g. a "+ New" button */
  action?: ReactNode;
}) {
  return (
    <div className="card p-10 text-center animate-fade-in-up">
      <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-pine-50 to-gold-50 grid place-items-center text-pine-400 mb-4">
        {icon ?? <DefaultEmptyIcon />}
      </div>
      <div className="font-display text-lg text-ink">{title}</div>
      {hint && <div className="text-sm text-muted mt-1 max-w-sm mx-auto">{hint}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Shared modal shell — backdrop blur + spring scale-in, Escape + backdrop-click
 *  to dismiss (unless `dismissible` is false, e.g. a mid-flow confirmation).
 *  New screens should reach for this instead of hand-rolling a `fixed inset-0`
 *  overlay; see the ~40 existing ad hoc overlays across features/* for the
 *  pattern this replaces. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-lg",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Tailwind max-width class, e.g. "max-w-2xl" for wider forms */
  maxWidth?: string;
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={dismissible ? onClose : undefined}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            className={clsx("w-full bg-surface rounded-2xl shadow-xl max-h-[88vh] flex flex-col overflow-hidden", maxWidth)}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-hairline shrink-0">
                <div className="font-display text-lg text-ink">{title}</div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-muted hover:bg-hairline/60 hover:text-ink transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="px-6 py-5 overflow-y-auto">{children}</div>
            {footer && (
              <div className="px-6 py-4 border-t border-hairline bg-cream/50 shrink-0 flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Segmented control with a sliding active-pill indicator. Drop-in for the
 *  many hand-rolled pill-toggle groups across the app (view switches, status
 *  filters) when you want the animated indicator instead of instant color swap. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const uid = useId();
  return (
    <div className="inline-flex items-center gap-1 rounded-pill bg-hairline p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx("relative pill", value === o.value ? "text-white" : "text-body hover:text-ink")}
        >
          {value === o.value && (
            <motion.span
              layoutId={`tabs-active-${uid}`}
              className="absolute inset-0 rounded-pill bg-ink -z-10"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
