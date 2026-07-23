/** Shared across every screen that shows an employee's pay (Employees
 *  master, HR roster): monthly-equivalent gross, for comparing pay across
 *  cadences at a glance. Daily uses the same 26-working-days estimate as
 *  the HR overview card; weekly uses 52 weeks / 12 months, same
 *  approximation payroll.py uses for the ESI eligibility ceiling on
 *  weekly-rated staff. */
export interface WageFields {
  wage_type: "monthly" | "daily" | "weekly";
  monthly_salary: string;
  daily_rate: string;
  weekly_rate: string;
}

export function monthlyEquivalent(e: WageFields): number {
  if (e.wage_type === "daily") return Number(e.daily_rate) * 26;
  if (e.wage_type === "weekly") return Number(e.weekly_rate) * 52 / 12;
  return Number(e.monthly_salary);
}
