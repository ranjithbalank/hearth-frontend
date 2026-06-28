import type { ReactNode } from "react";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[30%] bg-pine"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M5 21V11c0-3.9 3.1-7 7-7s7 3.1 7 7v10" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 21v-6" stroke="#E8B07A" strokeWidth="1.7" strokeLinecap="round" />
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
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      className={`rounded-card p-5 ${
        dark ? "bg-ink text-white" : "card"
      }`}
    >
      <div className={`stat-num text-3xl ${dark ? "text-white" : ""}`}>{value}</div>
      <div className={`text-xs mt-1 ${dark ? "text-pine-50/70" : "text-muted"}`}>{label}</div>
      {sub && <div className={`text-xs mt-2 ${dark ? "text-white/60" : "text-body"}`}>{sub}</div>}
    </div>
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
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-20 text-muted text-sm">
      <span className="animate-pulse">Loading…</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="font-display text-lg text-ink">{title}</div>
      {hint && <div className="text-sm text-muted mt-1">{hint}</div>}
    </div>
  );
}
