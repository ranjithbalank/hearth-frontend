/** Renders an ISO date ("2026-07-10") or timestamp as a human-readable date
 *  ("10 Jul 2026") — the API/inputs stay ISO, only display changes. */
export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const iso = value.length <= 10 ? `${value}T00:00:00` : value;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
