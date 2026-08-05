import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

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
  onClick,
  compact = false,
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
  /** makes the whole tile a drill-through — hover lift + keyboard-activatable */
  onClick?: () => void;
  /** Tighter padding and figure, for screens where the tile row competes with a
   *  chart for the fold — the dashboard's whole point is the chart, and a KPI
   *  row that pushes it under the fold has won an argument it shouldn't. */
  compact?: boolean;
}) {
  const dark = tone === "dark";
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => e.key === "Enter" && onClick!() : undefined}
      className={clsx(
        "relative overflow-hidden rounded-card animate-fade-in-up",
        compact ? "p-4" : "p-5",
        dark ? "bg-gradient-ink text-white shadow-md" : "card",
        interactive && "cursor-pointer transition-all duration-150 hover:-translate-y-0.5 " +
          (dark ? "hover:shadow-lg" : "hover:shadow-card-hover hover:border-pine-200"),
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
          <div className={clsx("stat-num", compact ? "text-2xl" : "text-3xl", dark && "text-white")}>{value}</div>
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
  /** ReactNode, not string: a screen whose subtitle describes a window the
   *  reader can change (a period, a range) can put that control here, beside
   *  the text it governs, instead of exiling it to the action row. */
  subtitle?: ReactNode;
  action?: ReactNode;
  /** small icon chip to the left of the title */
  icon?: ReactNode;
  /** tiny uppercase label above the title, e.g. a section name */
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between mb-6 gap-3 animate-fade-in-down">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="hidden sm:grid place-items-center w-11 h-11 rounded-2xl bg-gradient-primary text-white shrink-0 shadow-sm">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="text-xs font-bold uppercase tracking-widest text-pine mb-1">{eyebrow}</div>}
          <h1 className="font-display text-3xl font-semibold text-ink tracking-tight truncate">{title}</h1>
          {subtitle && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted mt-1">{subtitle}</div>
          )}
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

/** Segmented control. The active option gets a solid ink pill drawn directly on
 *  the button, so its white label always sits on a dark ground — an earlier
 *  version used a separately-positioned indicator at a negative z-index, which
 *  slipped behind the track and left the active label as white-on-light. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  iconOnly = false,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  /** `icon` is optional — pass a line icon (lucide) at ~14px; it sits before
   *  the label and inherits the tab's colour in both states. */
  options: { value: T; label: string; icon?: ReactNode }[];
  /** Show the icon alone. The label is still required and still reaches
   *  screen readers and the tooltip — it is hidden, not dropped, so the
   *  control stays operable without sight of the icon. Only for a set whose
   *  icons are unambiguous; a header running out of width is the usual
   *  reason to reach for it. */
  iconOnly?: boolean;
  /** "sm" is a lighter, smaller segmented control: a hairline track with a
   *  white chip on the active option instead of a filled dark pill. For a
   *  page header, where several controls sit together and the default's
   *  weight reads as a row of heavy blobs. */
  size?: "md" | "sm";
}) {
  const sm = size === "sm";
  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-pill",
        sm ? "gap-0.5 p-0.5 bg-cream border border-hairline" : "gap-1 p-1 bg-hairline",
      )}
    >
      {options.map((o) => {
        const bare = iconOnly && !!o.icon;
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            title={bare ? o.label : undefined}
            aria-label={bare ? o.label : undefined}
            aria-pressed={on}
            className={clsx(
              "inline-flex items-center justify-center rounded-pill font-semibold transition-colors duration-150",
              sm ? "gap-1 text-[13px]" : "gap-1.5 text-sm",
              sm
                ? (bare ? "px-2 py-1" : "px-2.5 py-1")
                : (bare ? "px-2.5 py-1.5" : o.icon ? "px-3.5 py-1.5" : "px-4 py-1.5"),
              on
                ? sm ? "bg-surface text-ink shadow-sm" : "bg-ink text-white shadow-sm"
                : "text-muted hover:text-ink" + (sm ? "" : " hover:bg-white/70"),
            )}
          >
            {o.icon}
            {bare ? <span className="sr-only">{o.label}</span> : o.label}
          </button>
        );
      })}
    </div>
  );
}
