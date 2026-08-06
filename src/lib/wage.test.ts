import { describe, expect, it } from "vitest";

import { monthlyEquivalent, type WageFields } from "./wage";

/** Monthly-equivalent gross, so pay on three different cadences can be
 *  compared in one column. The constants here are shared with the backend's
 *  payroll.py — if one side changes them, an employee's comparable pay reads
 *  differently on the roster than it does on the payslip. */
const employee = (over: Partial<WageFields>): WageFields => ({
  wage_type: "monthly", monthly_salary: "0", daily_rate: "0", weekly_rate: "0", ...over,
});

describe("monthlyEquivalent", () => {
  it("takes a monthly salary as it stands", () => {
    expect(monthlyEquivalent(employee({ wage_type: "monthly", monthly_salary: "30000" })))
      .toBe(30000);
  });

  it("bills a daily rate at 26 working days", () => {
    // 26, not 30 — the same working-month estimate the HR overview card and
    // payroll.py use. A calendar month here would overstate every daily-rated
    // employee's comparable pay by about 15%.
    expect(monthlyEquivalent(employee({ wage_type: "daily", daily_rate: "1000" })))
      .toBe(26000);
  });

  it("spreads a weekly rate over 52 weeks a year, not 4 a month", () => {
    // 52/12 ≈ 4.333. Using 4 would lose a whole week's pay a year.
    expect(monthlyEquivalent(employee({ wage_type: "weekly", weekly_rate: "1200" })))
      .toBeCloseTo(5200, 5);
  });

  it("reads the rate for the employee's own basis and ignores the others", () => {
    // Every employee row carries all three fields; only one is meaningful.
    // Reading the wrong one is how a daily-rated cook shows up on ₹0.
    expect(monthlyEquivalent(employee({
      wage_type: "daily", daily_rate: "500", monthly_salary: "99999", weekly_rate: "88888",
    }))).toBe(13000);
  });

  it("is zero rather than NaN when the rate has not been set yet", () => {
    expect(monthlyEquivalent(employee({ wage_type: "monthly", monthly_salary: "" }))).toBe(0);
  });
});
