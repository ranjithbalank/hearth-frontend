/** Renders an ISO date ("2026-07-10") or timestamp as a human-readable date
 *  ("10 Jul 2026") — the API/inputs stay ISO, only display changes. */
export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const iso = value.length <= 10 ? `${value}T00:00:00` : value;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Today's calendar date where the reader is standing, as ISO (YYYY-MM-DD).
 *
 *  `new Date().toISOString().slice(0, 10)` is the UTC date, which east of
 *  Greenwich is yesterday for the whole early shift — until 05:30 in IST. That
 *  is exactly when the night team reads a list headed "today", so a screen that
 *  filtered on it counted the wrong day's arrivals at the one hour it mattered.
 *
 *  Only the fallback: where the property has a business date, that wins — a
 *  property mid-night-audit is still trading yesterday. */
export function todayISO(): string {
  return isoOf(new Date());
}

/** A Date as an ISO calendar date in local time. Same reason as todayISO():
 *  `toISOString()` would shift the day across the UTC boundary. */
export function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Time-of-day greeting for dashboard headers. */
export function greeting(name?: string): string {
  const h = new Date().getHours();
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${g}, ${name}` : g;
}
