import { describe, expect, it } from "vitest";

import { fmtDate, greeting, isoOf, todayISO } from "./date";

/** Every assertion here is timezone-independent on purpose.
 *
 *  The bug these functions exist to prevent was a UTC/local mix-up, so a test
 *  that only passes in one timezone would be worse than none — it would go
 *  green on a laptop in India and red in a CI container on UTC, and everyone
 *  would learn to ignore it. Dates are therefore both CONSTRUCTED and asserted
 *  in local time: `new Date(2026, 7, 5)` is midnight local wherever it runs,
 *  and isoOf reads it back with local getters, so the pair agree everywhere. */
describe("isoOf", () => {
  it("formats a date as its local calendar day", () => {
    expect(isoOf(new Date(2026, 7, 5))).toBe("2026-08-05");
  });

  it("zero-pads single-digit months and days", () => {
    expect(isoOf(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("keeps the local day late in the evening, when UTC has already rolled over", () => {
    // 23:30 on the 5th. Anywhere east of Greenwich, toISOString() would call
    // this the 6th — which is exactly how "today" ended up meaning tomorrow
    // (or, in the morning case, yesterday) across six screens.
    const late = new Date(2026, 7, 5, 23, 30);
    expect(isoOf(late)).toBe("2026-08-05");
  });

  it("agrees with the local getters for any date, in any timezone", () => {
    for (const d of [
      new Date(2026, 0, 1, 0, 0),      // first minute of a year
      new Date(2026, 11, 31, 23, 59),  // last minute of a year
      new Date(2024, 1, 29),           // leap day
      new Date(2026, 7, 5, 4, 15),     // the early-shift hour that broke
    ]) {
      const p = (n: number) => String(n).padStart(2, "0");
      expect(isoOf(d)).toBe(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    }
  });
});

describe("todayISO", () => {
  it("is today's local calendar date", () => {
    expect(todayISO()).toBe(isoOf(new Date()));
  });

  it("is a well-formed ISO calendar date", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("fmtDate", () => {
  it("renders an ISO date the way people read it", () => {
    expect(fmtDate("2026-08-05")).toBe("05 Aug 2026");
  });

  it("renders a date-only string as that day, not the day before", () => {
    // A bare "2026-08-05" is parsed as UTC midnight by Date; west of Greenwich
    // that displays as the 4th. fmtDate appends T00:00:00 to force local.
    expect(fmtDate("2026-01-01")).toBe("01 Jan 2026");
  });

  it("shows an em dash for a missing value rather than an empty gap", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate("")).toBe("—");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    // Never "Invalid Date" on screen — if the API sends something unexpected,
    // showing it back is more useful to whoever has to debug it.
    expect(fmtDate("not-a-date")).toBe("not-a-date");
  });
});

describe("greeting", () => {
  it("addresses the person by name when there is one", () => {
    expect(greeting("Meera")).toMatch(/^Good (morning|afternoon|evening), Meera$/);
  });

  it("drops the comma when there is no name", () => {
    expect(greeting()).toMatch(/^Good (morning|afternoon|evening)$/);
  });
});
