import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ErrorState } from "./ErrorState";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[30%] bg-pine"
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

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  delta,
  deltaLabel,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "dark";
  /** percentage change vs a comparison period — renders a ▲/▼ pill */
  delta?: number;
  deltaLabel?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={`rounded-card p-5 ${
        dark ? "bg-ink text-white" : "card"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <div className={`stat-num text-3xl ${dark ? "text-white" : ""}`}>{value}</div>
        {delta !== undefined && (
          <span
            className={`pill text-[11px] ${
              delta > 0
                ? "bg-success-50 text-success"
                : delta < 0
                  ? "bg-clay-50 text-clay"
                  : "bg-hairline text-muted"
            }`}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}%
            {deltaLabel && ` ${deltaLabel}`}
          </span>
        )}
      </div>
      <div className={`text-xs mt-1 ${dark ? "text-white/60" : "text-muted"}`}>{label}</div>
      {sub && <div className={`text-xs mt-2 ${dark ? "text-white/60" : "text-body"}`}>{sub}</div>}
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
      {error && <span className="block text-[11px] text-clay mt-1">{error}</span>}
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
      className={`p-2 rounded-lg hover:bg-hairline/60 text-body ${className}`}
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
};

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`pill ${TONES[tone] ?? TONES.muted}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
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

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="font-display text-lg text-ink">{title}</div>
      {hint && <div className="text-sm text-muted mt-1">{hint}</div>}
    </div>
  );
}
